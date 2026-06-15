import { resolveMx } from "node:dns/promises";

export type EmailDomainMxResult =
  | { ok: true; domain: string; exchanges: string[] }
  | { ok: false; domain: string; reason: "invalid_email" | "no_mx" | "dns_error" };

const SIMPLE_EMAIL_RE = /^[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})$/i;

export async function checkEmailDomainMx(email: string): Promise<EmailDomainMxResult> {
  const match = email.trim().match(SIMPLE_EMAIL_RE);
  if (!match) return { ok: false, domain: "", reason: "invalid_email" };

  const domain = match[1].toLowerCase();
  try {
    const records = await resolveMx(domain);
    const exchanges = records.map((record) => record.exchange).filter(Boolean);
    if (!exchanges.length) return { ok: false, domain, reason: "no_mx" };
    return { ok: true, domain, exchanges };
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code?: unknown }).code) : "";
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "ENODOMAIN") {
      return { ok: false, domain, reason: "no_mx" };
    }
    return { ok: false, domain, reason: "dns_error" };
  }
}
