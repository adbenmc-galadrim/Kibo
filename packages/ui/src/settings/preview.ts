export type PreviewBlock = { kind: "h1" | "h2" | "li" | "p"; text: string };

export function previewBlocks(markdown: string): PreviewBlock[] {
  return markdown.split("\n").flatMap((line): PreviewBlock[] => {
    const t = line.trim();
    if (!t) return [];
    if (t.startsWith("## ")) return [{ kind: "h2", text: t.slice(3) }];
    if (t.startsWith("# ")) return [{ kind: "h1", text: t.slice(2) }];
    if (t.startsWith("- ")) return [{ kind: "li", text: t.slice(2) }];
    return [{ kind: "p", text: t }];
  });
}
