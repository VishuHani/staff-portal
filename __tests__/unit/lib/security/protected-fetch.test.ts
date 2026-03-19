import { afterEach, describe, expect, it, vi } from "vitest";
import * as dnsPromises from "dns/promises";
import { fetchProtectedBinaryUrl } from "@/lib/security/protected-fetch";

vi.mock("dns/promises", async () => {
  const actual = await vi.importActual<typeof import("dns/promises")>("dns/promises");
  return {
    ...actual,
    default: actual,
    lookup: vi.fn(),
  };
});

const mockedLookup = vi.mocked(dnsPromises.lookup);
const originalFetch = global.fetch;

describe("Protected fetch helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it("blocks localhost and private IP targets before making a request", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    await expect(
      fetchProtectedBinaryUrl("http://127.0.0.1/internal")
    ).rejects.toThrow(/Blocked private IP address/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks hosts that are not on the allowlist", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    await expect(
      fetchProtectedBinaryUrl("https://example.com/report.pdf", {
        allowedHosts: ["allowed.example"],
      })
    ).rejects.toThrow(/allowlist/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects responses that exceed the configured size limit", async () => {
    mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);

    global.fetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "content-length": "25",
        },
      })
    ) as typeof fetch;

    await expect(
      fetchProtectedBinaryUrl("https://example.com/report.pdf", {
        maxBytes: 10,
      })
    ).rejects.toThrow(/maximum allowed size/);
  });

  it("returns the binary body for an allowed host", async () => {
    mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);

    global.fetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: {
          "content-length": "4",
        },
      })
    ) as typeof fetch;

    const buffer = await fetchProtectedBinaryUrl("https://example.com/report.pdf", {
      allowedHosts: ["example.com"],
      maxBytes: 10,
    });

    expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});
