import { BlockList, isIP } from "node:net";

// Addresses a scraped founder URL must never reach: loopback, private,
// link-local (incl. cloud metadata 169.254.169.254), CGNAT, multicast, reserved.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
  ["192.0.2.0", 24], ["198.51.100.0", 24], ["203.0.113.0", 24],
] as const) blocked.addSubnet(net, prefix, "ipv4");

// IPv6: only global unicast (2000::/3) is allowed, minus ranges that tunnel
// or embed an IPv4 address (NAT64, Teredo, 6to4) and documentation space.
// Everything outside 2000::/3 (loopback, ::/96 IPv4-compatible, ULA,
// link-local, multicast) is refused by the allowlist check below.
const globalUnicast = new BlockList();
globalUnicast.addSubnet("2000::", 3, "ipv6");
for (const [net, prefix] of [
  ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16],
] as const) blocked.addSubnet(net, prefix, "ipv6");

/** True when the IP literal is not a public internet address. */
export function isBlockedAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedAddress(mapped[1]);
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) return !globalUnicast.check(address, "ipv6") || blocked.check(address, "ipv6");
  return true;
}

/**
 * Only plain http(s) on default ports, and never a hostname that is itself a
 * non-public IP or an obvious internal name. DNS results are checked again at
 * connect time by the scraper's dispatcher.
 */
export function isFetchableUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host)) return !isBlockedAddress(host);
  if (host === "localhost" || /\.(localhost|local|internal|lan|home)$/.test(host) || !host.includes(".")) return false;
  return true;
}
