import * as dnsPromises from "dns/promises";
import net from "net";
import { config } from "@/lib/config";

export interface ProtectedFetchOptions {
  allowedHosts?: string[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

function matchesHostPattern(hostname: string, pattern: string): boolean {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedPattern = normalizeHostname(pattern);

  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(1);
    return normalizedHost.endsWith(suffix) && normalizedHost !== suffix.slice(1);
  }

  return normalizedHost === normalizedPattern;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  );
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((segment) => Number.isNaN(segment))) {
    return true;
  }

  const [a, b] = parts;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  return false;
}

function normalizeIpv6(address: string): string {
  return address.toLowerCase().split("%")[0];
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = normalizeIpv6(ip);

  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice("::ffff:".length);
    if (net.isIP(mappedIpv4) === 4) {
      return isPrivateIpv4(mappedIpv4);
    }
  }

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.trim();
  const family = net.isIP(normalized);

  if (family === 4) {
    return isPrivateIpv4(normalized);
  }

  if (family === 6) {
    return isPrivateIpv6(normalized);
  }

  return true;
}

async function assertSafeHost(
  url: URL,
  allowedHosts: string[]
): Promise<void> {
  const hostname = normalizeHostname(url.hostname);

  if (!hostname) {
    throw new Error("Invalid URL hostname");
  }

  if (isLocalHostname(hostname)) {
    throw new Error(`Blocked local hostname: ${url.hostname}`);
  }

  if (net.isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error(`Blocked private IP address: ${url.hostname}`);
  }

  if (allowedHosts.length > 0) {
    const allowed = allowedHosts.some((pattern) => matchesHostPattern(hostname, pattern));
    if (!allowed) {
      throw new Error(`Blocked host not on allowlist: ${url.hostname}`);
    }
  }

  if (!net.isIP(hostname)) {
    const records = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
    if (!records.length) {
      throw new Error(`Unable to resolve host: ${url.hostname}`);
    }

    for (const record of records) {
      if (isPrivateAddress(record.address)) {
        throw new Error(`Blocked private address resolution for host: ${url.hostname}`);
      }
    }
  }
}

async function readResponseBodyWithLimit(
  response: Response,
  maxBytes: number
): Promise<ArrayBuffer> {
  const body = response.body;

  if (!body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Response exceeds maximum allowed size of ${maxBytes} bytes`);
    }
    return buffer;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error(`Response exceeds maximum allowed size of ${maxBytes} bytes`);
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result.buffer;
}

async function fetchOnce(url: URL, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchProtectedBinaryUrl(
  input: string,
  options: ProtectedFetchOptions = {}
): Promise<ArrayBuffer> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowedHosts = options.allowedHosts ?? config.documentFetch.allowedHosts;

  let currentUrl: URL;
  try {
    currentUrl = new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  if (currentUrl.protocol !== "http:" && currentUrl.protocol !== "https:") {
    throw new Error(`Unsupported URL scheme: ${currentUrl.protocol}`);
  }

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertSafeHost(currentUrl, allowedHosts);

    const response = await fetchOnce(currentUrl, timeoutMs);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect response from ${currentUrl.toString()} missing location`);
      }

      currentUrl = new URL(location, currentUrl);
      if (currentUrl.protocol !== "http:" && currentUrl.protocol !== "https:") {
        throw new Error(`Unsupported redirect scheme: ${currentUrl.protocol}`);
      }

      continue;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
        throw new Error(`Response exceeds maximum allowed size of ${maxBytes} bytes`);
      }
    }

    return readResponseBodyWithLimit(response, maxBytes);
  }

  throw new Error(`Too many redirects while fetching ${input}`);
}
