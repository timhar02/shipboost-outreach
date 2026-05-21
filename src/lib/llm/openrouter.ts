import { request } from "undici";

/**
 * Thin OpenRouter chat-completions client.
 * Free models work without billing once you have a key from openrouter.ai.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  /** 0.0 - 1.0; lower = more deterministic. Default 0.3 for on-voice writing. */
  temperature?: number;
  /** Max tokens to generate. Default 400 — enough for short copy. */
  maxTokens?: number;
  /** If true, the model is asked to return strict JSON. */
  jsonMode?: boolean;
  /** Per-call timeout in ms. Default 15s. */
  timeoutMs?: number;
};

export type ChatResult = { content: string; model: string; latencyMs: number };

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 400,
  };
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const start = Date.now();
  const { statusCode, body: resBody } = await request(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      // OpenRouter recommends these for usage stats; not required.
      "http-referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "x-title": "ShipBoost Outreach",
    },
    body: JSON.stringify(body),
    headersTimeout: opts.timeoutMs ?? 15_000,
    bodyTimeout: opts.timeoutMs ?? 15_000,
  });

  const text = await resBody.text();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`OpenRouter ${statusCode}: ${text.slice(0, 300)}`);
  }

  type ChatResponse = { choices?: { message?: { content?: string } }[] };
  const json = JSON.parse(text) as ChatResponse;
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error(`OpenRouter returned empty content: ${text.slice(0, 200)}`);

  return { content, model: opts.model, latencyMs: Date.now() - start };
}
