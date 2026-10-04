import { describe, expect, test } from "bun:test";
import {
  type BuiltChunk,
  FORBIDDEN_IN_ENTRY,
  initialChunks,
  reportEntry,
  reportGraph,
} from "./bundle-report";

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
      "/Kibo/components/kanban/src/Kanban.tsx",
      "/Kibo/components/notes/src/NotesView.tsx",
      "/Kibo/components/mcp-source/src/McpSource.tsx",
      "/Kibo/packages/ui/src/dialogs/mcp-source/McpSourceStep.tsx",
      "/Kibo/packages/ui/src/dialogs/NewProjectDialog.tsx",
      "/Kibo/packages/ui/src/dialogs/NewPageDialog.tsx",
      "/Kibo/packages/ui/src/dialogs/NewTicketDialog.tsx",
      "/Kibo/packages/ui/src/agents/AssignDialog.tsx",
      "/Kibo/packages/ui/src/agents/ProfileSheet.tsx",
      "/Kibo/packages/ui/src/shell/TicketSheet.tsx",
      "/Kibo/packages/ui/src/palette/CommandPalette.tsx",
      "/Kibo/packages/ui/src/components-page/PublishDialog.tsx",
      "/Kibo/packages/ui/src/pages/TicketTab.tsx",
      "/Kibo/packages/ui/src/shell/TicketDetail.tsx",
      "/Kibo/packages/ui/src/shell/PresenceAvatars.tsx",
      "/Kibo/packages/ui/src/shell/ProjectPresence.tsx",
      "/Kibo/packages/ui/src/shell/KeyRequired.tsx",
      "/Kibo/packages/ui/src/i18n/fr-presence.ts",
      pkg("@tauri-apps/plugin-updater", "dist-js/index.js"),
      pkg("@tauri-apps/api", "app.js"),
      "/Kibo/packages/ui/src/updates/UpdateCard.tsx",
      "/Kibo/packages/ui/src/updates/update-store.ts",
      "/Kibo/packages/ui/src/i18n/fr-updates.ts",
      "/Kibo/packages/ui/src/settings/AppearancePage.tsx",
      "/Kibo/packages/ui/src/settings/SecurityPage.tsx",
      "/Kibo/packages/ui/src/settings/WebAccessCard.tsx",
      "/Kibo/packages/ui/src/shell/DaemonUnreachable.tsx",
      "/Kibo/packages/ui/src/i18n/fr-startup.ts",
      "/Kibo/packages/ui/src/files/FileToolbar.tsx",
      "/Kibo/packages/ui/src/files/WrapSwitch.tsx",
      "/Kibo/packages/ui/src/i18n/fr-file-tools.ts",
      "/Kibo/packages/ui/src/settings/SyncEmptyState.tsx",
      "/Kibo/packages/ui/src/i18n/fr-sync-page.ts",
      "/Kibo/packages/ui/src/agents/RunHistory.tsx",
      "/Kibo/packages/ui/src/i18n/fr-agents-page.ts",
    ];
    for (const id of forbidden) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(id))).toBe(true);
    for (const id of [
      "/Kibo/components/notes/src/NotesWidget.tsx",
      "/Kibo/components/graph/src/GraphWidget.tsx",
      "/Kibo/packages/ui/src/agents/AgentPanel.tsx",
      "/Kibo/packages/ui/src/shell/use-update-schedule.ts",
      "/Kibo/components/mcp-source/src/config.ts",
      "/Kibo/packages/ui/src/shell/Startup.tsx",
      "/Kibo/packages/ui/src/shell/RootBoundary.tsx",
    ])
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(id))).toBe(false);
  });

  test("the wave 4 chunks are forbidden in the entry", () => {
    const paths = [
      "/x/packages/ui/src/pages/InstanceMenuContent.tsx",
      "/x/packages/ui/src/pages/LayoutEditor.tsx",
      "/x/packages/ui/src/pages/LayoutToolbar.tsx",
      "/x/packages/ui/src/pages/FormatMenu.tsx",
      "/x/packages/ui/src/i18n/fr-layout.ts",
      "/x/packages/ui/src/creations/CreationsPage.tsx",
      "/x/packages/ui/src/creations/creation-status.ts",
      "/x/packages/ui/src/i18n/fr-creations.ts",
      "/x/packages/ui/src/ai/DraftPreviewFrame.tsx",
      "/x/packages/sdk/src/mock.ts",
      "/x/packages/sdk/src/mock-calls.ts",
      "/x/packages/sdk/src/mock-notes.ts",
      "/x/packages/sdk/src/fixtures.ts",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    expect(FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/packages/ui/src/pages/DashboardGrid.tsx"))).toBe(false);
  });

  test("the draft preview host and its demo project are forbidden in the entry", () => {
    const paths = [
      "/x/packages/ui/src/ai/worker-backend.ts",
      "/x/packages/ui/src/ai/preview-protocol.ts",
      "/x/packages/ui/src/ai/preview-backend.ts",
      "/x/packages/ui/src/ai/draft-preview-worker.ts",
      "/x/packages/ui/src/ai/revise-escape.ts",
      "/x/packages/core/src/index.ts",
      "/x/node_modules/.bun/loro-crdt@1.16.3/node_modules/loro-crdt/browser/index.js",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
  });

  test("three and the sdk 3d and game kits never reach the entry", () => {
    const three = pkg("three", "build/three.module.js");
    const chunks = [
      chunk("index.js", { isEntry: true, moduleIds: [three] }),
      chunk("Viewer3d.js", { moduleIds: [pkg("three", "examples/jsm/loaders/GLTFLoader.js")] }),
    ];
    const report = reportEntry(chunks, { budget: 1_000_000, forbidden: FORBIDDEN_IN_ENTRY, gzip: rawSize });
    expect(report.forbidden).toEqual([{ file: "index.js", module: three }]);
    const paths = [
      "/x/packages/sdk/src/three/ThreeCanvas.tsx",
      "/x/packages/sdk/src/three/index.ts",
      "/x/packages/sdk/src/game/loop.ts",
      "/x/packages/sdk/src/fixtures-glb.ts",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    expect(
      FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/node_modules/.bun/threejs-x@1/node_modules/threejs-x/a.js")),
    ).toBe(false);
  });

  test("the preview worker must be emitted under workers/", () => {
    const chunks = [chunk("assets/index.js", { isEntry: true })];
    expect(reportGraph(chunks, ["assets/index.js", "workers/draft-preview-worker-Ab1_c.js"])).toEqual({
      previewWorker: "workers/draft-preview-worker-Ab1_c.js",
      forbidden: [],
      ok: true,
    });
    expect(reportGraph(chunks, ["assets/index.js", "assets/draft-preview-worker-Ab1.js"])).toMatchObject({
      previewWorker: null,
      ok: false,
    });
  });

  test("core and loro fail the build in any chunk of the main graph, initial or lazy", () => {
    const core = "/x/packages/core/src/index.ts";
    const loro = pkg("loro-crdt", "browser/index.js");
    const chunks = [
      chunk("assets/index.js", { isEntry: true }),
      chunk("assets/DraftPreviewFrame.js", { moduleIds: [core] }),
      chunk("assets/lazy.js", { moduleIds: [loro, "/x/packages/ui/src/App.tsx"] }),
    ];
    const report = reportGraph(chunks, ["workers/draft-preview-worker-1.js"]);
    expect(report.ok).toBe(false);
    expect(report.forbidden).toEqual([
      { file: "assets/DraftPreviewFrame.js", module: core },
      { file: "assets/lazy.js", module: loro },
    ]);
  });
});
