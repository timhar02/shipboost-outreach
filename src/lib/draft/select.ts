export type Template = { key: string; subject: string; bodyHtml: string };

export function selectTemplate<T extends { key: string }>(domain: string, templates: T[]): T {
  if (templates.length === 0) throw new Error("no templates");
  let h = 2166136261;
  for (let i = 0; i < domain.length; i++) {
    h ^= domain.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return templates[(h >>> 0) % templates.length];
}
