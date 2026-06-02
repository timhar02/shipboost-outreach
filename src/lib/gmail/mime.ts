type RawHtmlEmailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string | undefined>;
};

export function buildRawHtmlEmail(input: RawHtmlEmailInput): string {
  const message = [
    `From: ${escapeHeader(input.from)}`,
    `To: ${escapeHeader(input.to)}`,
    `Subject: ${encodeSubject(input.subject)}`,
    ...formatExtraHeaders(input.headers),
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    input.html,
  ].join("\r\n");

  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHeader(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

function formatExtraHeaders(headers: RawHtmlEmailInput["headers"]): string[] {
  if (!headers) return [];
  return Object.entries(headers)
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([name, value]) => `${escapeHeaderName(name)}: ${escapeHeader(value)}`);
}

function escapeHeaderName(name: string): string {
  const clean = name.trim();
  if (!/^[A-Za-z0-9-]+$/.test(clean)) throw new Error(`Invalid email header name: ${name}`);
  return clean;
}

function encodeSubject(subject: string): string {
  const clean = escapeHeader(subject);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}
