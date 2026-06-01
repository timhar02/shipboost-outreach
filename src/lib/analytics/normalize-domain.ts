/**
 * Reduce any URL or host string to a bare, comparable domain:
 * lowercased, no scheme, no `www.`, no userinfo, no port, no path/query/hash.
 * Used on both sides of conversion matching so a scraped contact domain and a
 * submitted product URL compare equal.
 */
export function normalizeDomain(input: string | null | undefined): string {
  if (!input) return "";

  let value = input.trim().toLowerCase();
  if (!value) return "";

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  value = value.split(/[/?#]/)[0] ?? ""; // path/query/hash

  const atIndex = value.lastIndexOf("@");
  if (atIndex !== -1) value = value.slice(atIndex + 1); // userinfo

  value = value.split(":")[0] ?? ""; // port
  value = value.replace(/^www\./, ""); // leading www.
  value = value.replace(/\.+$/, ""); // trailing dot

  return value;
}
