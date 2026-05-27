import { NextResponse, type NextRequest } from "next/server";
import { extractContext } from "@/lib/scrape/extract-context";
import { personalize } from "@/lib/draft/personalize";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Compare LLM personalizers head-to-head on the same product.
 *
 * GET /api/debug/llm-shootout?url=https://example.com&name=Example&tagline=Foo&firstName=Sarah
 *   - url       (required) - product website
 *   - name      (required) - product name
 *   - tagline   (optional)
 *   - firstName (optional)
 *   - models    (optional, comma-separated) - default: deepseek + glm
 */

const DEFAULT_MODELS = [
  "deepseek/deepseek-v4-flash:free",
  "z-ai/glm-5.1",
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const name = req.nextUrl.searchParams.get("name");
  if (!url || !name) {
    return NextResponse.json({ ok: false, error: "url and name required" }, { status: 400 });
  }
  const tagline = req.nextUrl.searchParams.get("tagline") ?? undefined;
  const firstName = req.nextUrl.searchParams.get("firstName") ?? undefined;
  const modelsParam = req.nextUrl.searchParams.get("models");
  const models = modelsParam ? modelsParam.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_MODELS;

  let websiteDomain: string;
  try {
    websiteDomain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid url" }, { status: 400 });
  }

  let context;
  try {
    context = await extractContext(url);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `extractContext failed: ${err instanceof Error ? err.message : err}` },
      { status: 500 },
    );
  }

  // Run all models concurrently.
  const results = await Promise.all(
    models.map(async (model) => {
      try {
        const r = await personalize(
          { productName: name, tagline, websiteDomain, firstName, context },
          { model, maxRetries: 1 },
        );
        return { ok: true, ...r };
      } catch (err) {
        return { model, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  return NextResponse.json({
    ok: true,
    input: { url, name, tagline, firstName, websiteDomain },
    context,
    results,
  });
}
