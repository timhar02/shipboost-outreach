import { checkEmailDomainMx } from "./mx";

export type RecipientValidationResult =
  | { ok: true; source: "mx" | "abstractapi" }
  | { ok: false; source: "mx" | "abstractapi"; reason: string };

type AbstractApiResponse = {
  deliverability?: string;
  is_valid_format?: { value?: boolean };
};

export async function validateRecipientEmail(email: string): Promise<RecipientValidationResult> {
  const mx = await checkEmailDomainMx(email);
  if (!mx.ok) return { ok: false, source: "mx", reason: mx.reason };

  const provider = process.env.EMAIL_VALIDATION_PROVIDER ?? "none";
  if (provider === "none") return { ok: true, source: "mx" };
  if (provider !== "abstractapi") return { ok: true, source: "mx" };

  const apiKey = process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY;
  if (!apiKey) return { ok: true, source: "mx" };

  const url = new URL("https://emailvalidation.abstractapi.com/v1/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("email", email);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) return { ok: true, source: "mx" };

  const body = (await res.json()) as AbstractApiResponse;
  if (body.is_valid_format?.value === false) {
    return { ok: false, source: "abstractapi", reason: "invalid_email" };
  }
  if (String(body.deliverability ?? "").toUpperCase() === "UNDELIVERABLE") {
    return { ok: false, source: "abstractapi", reason: "mailbox_undeliverable" };
  }

  return { ok: true, source: "abstractapi" };
}
