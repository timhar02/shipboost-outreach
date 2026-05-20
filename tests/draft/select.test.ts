import { describe, it, expect } from "vitest";
import { selectTemplate } from "@/lib/draft/select";

const templates = [
  { key: "a", subject: "", bodyHtml: "" },
  { key: "b", subject: "", bodyHtml: "" },
  { key: "c", subject: "", bodyHtml: "" },
];

describe("selectTemplate", () => {
  it("is deterministic for same domain", () => {
    expect(selectTemplate("acme.io", templates).key).toBe(selectTemplate("acme.io", templates).key);
  });
  it("distributes across templates", () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 900; i++) counts[selectTemplate(`d${i}.com`, templates).key]++;
    for (const k of Object.keys(counts)) expect(counts[k]).toBeGreaterThan(200);
  });
});
