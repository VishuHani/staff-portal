/**
 * Audit Helper Utilities
 *
 * Provides utility functions for audit logging including:
 * - IP address capture
 * - Request context extraction
 * - Standardized audit log creation
 */

import { headers } from "next/headers";

/**
 * Get client IP address from request headers
 *
 * Checks multiple headers in order of preference:
 * 1. X-Forwarded-For (standard proxy header)
 * 2. X-Real-IP (Nginx proxy header)
 * 3. CF-Connecting-IP (Cloudflare header)
 * 4. X-Client-IP (Alternative proxy header)
 *
 * @returns Promise resolving to IP address string or "unknown"
 */
export async function getClientIpAddress(): Promise<string> {
  try {
    const headersList = await headers();

    // Check X-Forwarded-For header (most common)
    const forwardedFor = headersList.get("x-forwarded-for");
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, first is the client
      const ips = forwardedFor.split(",").map((ip) => ip.trim());
      if (ips[0]) {
        return ips[0];
      }
    }

    // Check X-Real-IP header (Nginx)
    const realIp = headersList.get("x-real-ip");
    if (realIp) {
      return realIp;
    }

    // Check CF-Connecting-IP header (Cloudflare)
    const cfIp = headersList.get("cf-connecting-ip");
    if (cfIp) {
      return cfIp;
    }

    // Check X-Client-IP header
    const clientIp = headersList.get("x-client-ip");
    if (clientIp) {
      return clientIp;
    }

    // Check X-Cluster-Client-IP (AWS ELB)
    const clusterIp = headersList.get("x-cluster-client-ip");
    if (clusterIp) {
      return clusterIp;
    }

    return "unknown";
  } catch (error) {
    console.error("Error getting client IP:", error);
    return "unknown";
  }
}

/**
 * Get user agent from request headers
 *
 * @returns Promise resolving to user agent string or "unknown"
 */
export async function getUserAgent(): Promise<string> {
  try {
    const headersList = await headers();
    return headersList.get("user-agent") || "unknown";
  } catch (error) {
    console.error("Error getting user agent:", error);
    return "unknown";
  }
}

/**
 * Get full audit context from request
 *
 * Returns IP address and user agent for comprehensive audit logging
 *
 * @returns Promise resolving to audit context object
 */
export async function getAuditContext(): Promise<{
  ipAddress: string;
  userAgent: string;
}> {
  const [ipAddress, userAgent] = await Promise.all([
    getClientIpAddress(),
    getUserAgent(),
  ]);

  return { ipAddress, userAgent };
}

/**
 * Mask sensitive data for audit logs
 *
 * Replaces sensitive values with masked versions to prevent
 * exposure of PII in audit logs while still providing useful info
 *
 * @param value - The value to potentially mask
 * @param sensitive - Whether the value is sensitive
 * @returns Masked or original value
 */
export function maskSensitiveValue(
  value: string | undefined | null,
  sensitive: boolean = false
): string | undefined | null {
  if (!value || !sensitive) {
    return value;
  }

  // For emails, show first 2 chars and domain
  if (value.includes("@")) {
    const [localPart, domain] = value.split("@");
    const maskedLocal = localPart.slice(0, 2) + "***";
    return `${maskedLocal}@${domain}`;
  }

  // For other sensitive values, show first 2 and last 2 chars
  if (value.length > 4) {
    return value.slice(0, 2) + "***" + value.slice(-2);
  }

  return "***";
}
