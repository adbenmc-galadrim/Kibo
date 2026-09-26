import { describe, expect, test } from "bun:test";
import { type BuiltChunk, FORBIDDEN_IN_ENTRY, initialChunks, reportEntry } from "./bundle-report";

const chunk = (fileName: string, over: Partial<BuiltChunk> = {}): BuiltChunk => ({
  fileName,
  isEntry: false,
  imports: [],
  code: "x",
  moduleIds: [],
  ...over,
});
const rawSize = (bytes: Uint8Array) => bytes.length;
const pkg = (name: string, file: string) =>
  `/r/node_modules/.bun/${name.replace("/", "+")}@1.0.0/node_modules/${name}/${file}`;

describe("bundle report", () => {
  test("initial chunks are the entry and its static imports, transitively, never dynamic ones", () => {
    const chunks = [
      chunk("index.js", { isEntry: true, imports: ["react.js"] }),
      chunk("react.js", { imports: ["scheduler.js", "index.js"] }),
      chunk("scheduler.js"),
      chunk("NotesView.js"),
    ];
    expect(initialChunks(chunks).map((c) => c.fileName)).toEqual(["index.js", "react.js", "scheduler.js"]);
  });

  test("sums the gzip size of initial chunks against the budget", () => {
    const chunks = [
      chunk("index.js", { isEntry: true, imports: ["a.js"], code: "1234" }),
      chunk("a.js", { code: "56" }),
      chunk("lazy.js", { code: "7".repeat(100) }),
    ];
    expect(reportEntry(chunks, { budget: 6, forbidden: [], gzip: rawSize })).toMatchObject({
      gzipBytes: 6,
      ok: true,
    });
    expect(reportEntry(chunks, { budget: 5, forbidden: [], gzip: rawSize }).ok).toBe(false);
  });

  test("a forbidden module in an initial chunk fails, even under budget", () => {
    const md = pkg("markdown-it", "index.mjs");
    const chunks = [
      chunk("index.js", { isEntry: true, moduleIds: [md] }),
      chunk("lazy.js", { moduleIds: [pkg("@codemirror/view", "dist/index.js")] }),
    ];
    const report = reportEntry(chunks, { budget: 1_000_000, forbidden: FORBIDDEN_IN_ENTRY, gzip: rawSize });
    expect(report.ok).toBe(false);
    expect(report.forbidden).toEqual([{ file: "index.js", module: md }]);
  });

  test("default rules forbid heavy editors and secondary screens, not widgets", () => {
    const forbidden = [
      pkg("@codemirror/view", "dist/index.js"),
      pkg("@lezer/markdown", "dist/index.js"),
      pkg("codemirror", "dist/index.js"),
      pkg("markdown-it", "index.mjs"),
      pkg("shiki", "dist/index.mjs"),
      pkg("@shikijs/langs", "dist/tsx.mjs"),
      pkg("sonner", "dist/index.mjs"),
      pkg("next-themes", "dist/index.mjs"),
      "/Kibo/packages/ui/src/agents/AgentsPage.tsx",
      "/Kibo/packages/ui/src/agents/QueuePage.tsx",
      "/Kibo/packages/ui/src/settings/DomainsPage.tsx",
      "/Kibo/packages/ui/src/components-page/ComponentsPage.tsx",
      "/Kibo/packages/ui/src/mine/MyTicketsPage.tsx",
      "/Kibo/packages/ui/src/code/ChangesView.tsx",
      "/Kibo/packages/ui/src/files/FileTabView.tsx",
      "/Kibo/packages/ui/src/files/FilePreviewSheet.tsx",
      "/Kibo/packages/ui/src/shell/IntegrationNotices.tsx",
      "/Kibo/packages/ui/src/pages/SourceHeader.tsx",
      "/Kibo/components/graph/src/GraphView.tsx",
      "/Kibo/components/notes/src/NotesView.tsx",
    ];
    for (const id of forbidden) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(id))).toBe(true);
    for (const id of [
      "/Kibo/components/notes/src/NotesWidget.tsx",
      "/Kibo/components/graph/src/GraphWidget.tsx",
      "/Kibo/packages/ui/src/agents/AgentPanel.tsx",
    ])
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(id))).toBe(false);
  });
});
