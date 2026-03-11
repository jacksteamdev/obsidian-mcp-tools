import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "dns/promises";

const PRIVATE_IP_RANGES = [
  // 0.0.0.0/8
  { start: 0x00000000, end: 0x00ffffff },
  // 10.0.0.0/8
  { start: 0x0a000000, end: 0x0affffff },
  // 127.0.0.0/8
  { start: 0x7f000000, end: 0x7fffffff },
  // 169.254.0.0/16 (link-local + cloud metadata)
  { start: 0xa9fe0000, end: 0xa9feffff },
  // 172.16.0.0/12
  { start: 0xac100000, end: 0xac1fffff },
  // 192.168.0.0/16
  { start: 0xc0a80000, end: 0xc0a8ffff },
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const num = ipv4ToInt(ip);
  return PRIVATE_IP_RANGES.some((range) => num >= range.start && num <= range.end);
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized === "::" ||
    // IPv4-mapped IPv6 like ::ffff:127.0.0.1
    (normalized.startsWith("::ffff:") && isPrivateIPv4(normalized.slice(7)))
  );
}

function isPrivateIP(ip: string): boolean {
  if (ip.includes(":")) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
}

export async function validateUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new McpError(ErrorCode.InvalidParams, `Invalid URL: ${url}`);
  }

  // Allow only http and https schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new McpError(
      ErrorCode.InvalidParams,
      `URL scheme "${parsed.protocol}" is not allowed. Only http: and https: are permitted.`,
    );
  }

  const hostname = parsed.hostname;

  // Check if hostname is a literal IP address
  // Strip brackets from IPv6 addresses
  const bareHost = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // Check literal IP addresses directly
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bareHost) || bareHost.includes(":")) {
    if (isPrivateIP(bareHost)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `URL resolves to a blocked private/reserved IP address.`,
      );
    }
    return;
  }

  // Resolve hostname to IP addresses and check each one
  let addresses: string[];
  try {
    addresses = await resolve(hostname);
  } catch {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Could not resolve hostname: ${hostname}`,
    );
  }

  for (const addr of addresses) {
    if (isPrivateIP(addr)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `URL resolves to a blocked private/reserved IP address.`,
      );
    }
  }
}
