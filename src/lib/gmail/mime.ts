type RawHtmlEmailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

export function buildRawHtmlEmail(input: RawHtmlEmailInput): string {
  const message = [
    `From: ${escapeHeader(input.from)}`,
    `To: ${escapeHeader(input.to)}`,
    `Subject: ${encodeSubject(input.subject)}`,
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

function encodeSubject(subject: string): string {
  const clean = escapeHeader(subject);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}
