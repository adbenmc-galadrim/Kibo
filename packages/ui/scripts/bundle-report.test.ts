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
      "/Kibo/packages/ui/src/today/TodayPage.tsx",
      "/Kibo/packages/ui/src/files/FileTabView.tsx",
      "/Kibo/packages/ui/src/files/FilePreviewSheet.tsx",
      "/Kibo/packages/ui/src/shell/IntegrationNotices.tsx",
      "/Kibo/components/graph/src/GraphView.tsx",
      "/Kibo/components/kanban/src/Kanban.tsx",
      "/Kibo/packages/ui/src/dialogs/NewProjectDialog.tsx",
      "/Kibo/packages/ui/src/dialogs/NewPageDialog.tsx",
      "/Kibo/packages/ui/src/dialogs/NewTicketDialog.tsx",
      "/Kibo/packages/ui/src/shell/TicketSheet.tsx",
      "/Kibo/packages/ui/src/palette/CommandPalette.tsx",
      "/Kibo/packages/ui/src/pages/TicketTab.tsx",
      "/Kibo/packages/ui/src/shell/TicketDetail.tsx",
      pkg("@tauri-apps/plugin-updater", "dist-js/index.js"),
      pkg("@tauri-apps/api", "app.js"),
      "/Kibo/packages/ui/src/updates/UpdateCard.tsx",
      "/Kibo/packages/ui/src/updates/update-store.ts",
      "/Kibo/packages/ui/src/i18n/fr-updates.ts",
      "/Kibo/packages/ui/src/settings/AppearancePage.tsx",
      "/Kibo/packages/ui/src/i18n/fr-appearance.ts",
      "/Kibo/packages/ui/src/shell/Unpaired.tsx",
      "/Kibo/packages/ui/src/shell/DaemonUnreachable.tsx",
      "/Kibo/packages/ui/src/i18n/fr-startup.ts",
      "/Kibo/packages/ui/src/files/FileToolbar.tsx",
      "/Kibo/packages/ui/src/files/WrapSwitch.tsx",
      "/Kibo/packages/ui/src/i18n/fr-file-tools.ts",
      "/Kibo/packages/ui/src/files/ProjectFilesDialog.tsx",
      "/Kibo/packages/ui/src/files/FilesDirDialog.tsx",
      "/Kibo/packages/ui/src/files/FilesList.tsx",
      "/Kibo/packages/ui/src/files/use-project-files.ts",
      "/Kibo/packages/ui/src/files/upload.ts",
      "/Kibo/packages/ui/src/files/slug.ts",
      "/Kibo/packages/ui/src/i18n/fr-files.ts",
    ];
    for (const id of forbidden) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(id))).toBe(true);
    for (const id of [
      "/Kibo/components/graph/src/GraphWidget.tsx",
      "/Kibo/packages/ui/src/shell/use-update-schedule.ts",
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
      "/x/packages/sdk/src/mock.ts",
      "/x/packages/sdk/src/mock-calls.ts",
      "/x/packages/sdk/src/fixtures.ts",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    expect(FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/packages/ui/src/pages/DashboardGrid.tsx"))).toBe(false);
  });

  test("the about, what's new and application chunks are forbidden in the entry, not the help hook", () => {
    const paths = [
      "/x/packages/ui/src/about/AboutDialog.tsx",
      "/x/packages/ui/src/about/about-text.ts",
      "/x/packages/ui/src/whats-new/WhatsNewDialog.tsx",
      "/x/packages/ui/src/whats-new/BundledWhatsNewDialog.tsx",
      "/x/packages/ui/src/i18n/fr-about.ts",
      "/x/packages/ui/src/i18n/fr-whats-new.ts",
      "/x/packages/ui/src/settings/ApplicationCard.tsx",
      "/x/packages/ui/src/desktop/autostart.ts",
      "/x/packages/ui/src/whats-new/whats-new.ts",
      "/x/packages/ui/src/desktop/about-event.ts",
      "/x/packages/ui/src/shell/HelpDialogs.tsx",
      "/x/packages/ui/src/shell/help-boot.ts",
      "/x/packages/ui/src/shell/help-labels.ts",
      "/x/CHANGELOG.md?raw",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    for (const p of ["/x/packages/ui/src/shell/use-app-help.ts", "/x/packages/ui/src/shell/help-dialogs.ts"])
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(false);
  });

  test("the shortcuts help and the problem report stay out of the entry, not the shortcut hook", () => {
    const paths = [
      "/x/packages/ui/src/help/ShortcutsDialog.tsx",
      "/x/packages/ui/src/settings/ShortcutList.tsx",
      "/x/packages/ui/src/settings/shortcuts.ts",
      "/x/packages/ui/src/report/ReportDialog.tsx",
      "/x/packages/ui/src/report/report-text.ts",
      "/x/packages/ui/src/i18n/fr-report.ts",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    expect(FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/packages/ui/src/tabs/use-tab-shortcuts.ts"))).toBe(
      false,
    );
  });

  test("frame url parsing and config validation stay out of the entry, not the schemas", () => {
    for (const p of ["/x/packages/schema/src/design-url.ts", "/x/packages/schema/src/config-validate.ts"]) {
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    }
    for (const p of ["/x/packages/schema/src/design.ts", "/x/packages/schema/src/config.ts"]) {
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(false);
    }
  });

  test("core and loro are forbidden in the entry", () => {
    const paths = [
      "/x/packages/core/src/index.ts",
      "/x/node_modules/.bun/loro-crdt@1.16.3/node_modules/loro-crdt/browser/index.js",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
  });

  test("the sprint sheet, its texts and the lazy page actions stay out of the entry, not the route parsing", () => {
    const paths = [
      "/x/packages/ui/src/shell/sprint/SprintSheet.tsx",
      "/x/packages/ui/src/shell/sprint/SprintTab.tsx",
      "/x/packages/ui/src/shell/sprint/sprint-route.ts",
      "/x/packages/ui/src/shell/sprint/use-sprint-view.ts",
      "/x/packages/ui/src/i18n/fr-sprint.ts",
      "/x/packages/ui/src/shell/nav/overview-page.ts",
      "/x/packages/ui/src/shell/nav/new-ticket-pages.ts",
      "/x/packages/ui/src/shell/nav/NewTicketAction.tsx",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    for (const p of [
      "/x/packages/ui/src/tabs/target-hash.ts",
      "/x/packages/ui/src/shell/nav/overview-missing.ts",
      "/x/packages/ui/src/i18n/fr-nav-tracking.ts",
    ])
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(false);
  });

  test("the sdk glb fixtures never reach the entry", () => {
    expect(FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/packages/sdk/src/fixtures-glb.ts"))).toBe(true);
  });

  test("core and loro fail the build in any chunk of the main graph, initial or lazy", () => {
    const core = "/x/packages/core/src/index.ts";
    const loro = pkg("loro-crdt", "browser/index.js");
    const chunks = [
      chunk("assets/index.js", { isEntry: true }),
      chunk("assets/DraftPreviewFrame.js", { moduleIds: [core] }),
      chunk("assets/lazy.js", { moduleIds: [loro, "/x/packages/ui/src/App.tsx"] }),
    ];
    const report = reportGraph(chunks);
    expect(report.ok).toBe(false);
    expect(report.forbidden).toEqual([
      { file: "assets/DraftPreviewFrame.js", module: core },
      { file: "assets/lazy.js", module: loro },
    ]);
  });

  test("the backups card, its texts and the folder reveal are forbidden in the entry", () => {
    const paths = [
      "/x/packages/ui/src/backups/BackupsCard.tsx",
      "/x/packages/ui/src/backups/BackupsList.tsx",
      "/x/packages/ui/src/backups/backups-text.ts",
      "/x/packages/ui/src/i18n/fr-backups.ts",
      "/x/packages/ui/src/desktop/reveal.ts",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
  });

  test("the project agent is forbidden in the entry", () => {
    const paths = [
      "/x/packages/ui/src/project-agent/ProjectAgentButton.tsx",
      "/x/packages/ui/src/project-agent/ProjectAgentPanel.tsx",
      "/x/packages/ui/src/project-agent/BatchCard.tsx",
      "/x/packages/ui/src/project-agent/conversation.ts",
      "/x/packages/ui/src/project-agent/use-project-agent.ts",
      "/x/packages/ui/src/i18n/fr-project-agent.ts",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    expect(
      FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/packages/ui/src/shell/use-project-agent-panel.ts")),
    ).toBe(false);
  });

  test("the design dialogs, their problems and texts are forbidden in the entry", () => {
    const paths = [
      "/x/packages/ui/src/i18n/fr-design.ts",
      "/x/packages/ui/src/dialogs/integrations/FigmaConnectDialog.tsx",
      "/x/packages/ui/src/dialogs/integrations/PenpotConnectDialog.tsx",
      "/x/packages/ui/src/dialogs/integrations/design-problem.ts",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    expect(FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/packages/ui/src/i18n/fr-integration-rows.ts"))).toBe(
      false,
    );
  });

  test("the mockups section, its property and the frame field are forbidden in the entry", () => {
    const paths = [
      "/x/packages/ui/src/shell/sheet/DesignSection.tsx",
      "/x/packages/ui/src/shell/sheet/DesignProperty.tsx",
      "/x/packages/ui/src/shell/sheet/design-refs.ts",
      "/x/packages/ui/src/shell/sheet/LinkedFrame.tsx",
      "/x/packages/ui/src/shell/sheet/use-design-thumbs.ts",
      "/x/packages/ui/src/shell/sheet/lazy-fullscreen.ts",
      "/x/packages/ui/src/dialogs/FrameField.tsx",
      "/x/components/mockup/src/FrameFullscreen.tsx",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
  });

  test("the agents dock, the feed, their texts, the mention and the hover card are forbidden in the entry", () => {
    const paths = [
      "/x/packages/ui/src/i18n/fr-moments.ts",
      "/x/packages/sdk/src/ui/hover-card.tsx",
      "/x/packages/sdk/src/agent-mention.tsx",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
    const entry = [
      "shell/use-run-panel.ts",
      "agents/AgentBar.tsx",
      "agents/BarRuns.tsx",
      "agents/bar-summary.ts",
      "agents/AgentPanel.tsx",
    ];
    for (const p of entry)
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/ui/src/${p}`))).toBe(false);
  });
  test("the activity tab of a ticket is forbidden in the entry", () => {
    const paths = [
      "/x/packages/ui/src/ticket/activity/TicketTimeline.tsx",
      "/x/packages/ui/src/ticket/activity/ticket-timeline.ts",
    ];
    for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
  });
  test("vague 23, repli des textes de fr.ts", () => {
    for (const p of ["fr-domains.ts", "fr-integrations.ts"])
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/ui/src/i18n/${p}`))).toBe(true);
    for (const p of ["fr.ts", "fr-integration-rows.ts"])
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/ui/src/i18n/${p}`))).toBe(false);
  });
  test("vague 23, dossiers de guidelines", () => {
    const paths = ["dialogs/GuidelinesField.tsx", "ticket/DomainSelect.tsx", "i18n/fr-domains.ts"];
    for (const p of paths)
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/ui/src/${p}`))).toBe(true);
    expect(FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/packages/ui/src/tabs/target-hash.ts"))).toBe(false);
  });
  test("vague 23, contenu de l'aperçu de question", () => {
    const sdk = (p: string) => FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/sdk/src/${p}`));
    expect(sdk("question-preview-content.tsx")).toBe(true);
    expect(sdk("question-preview.tsx")).toBe(false);
  });

  test("phase 24, component management texts stay out of the entry, not the instance texts", () => {
    const i18n = (p: string) => FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/ui/src/i18n/${p}`));
    expect(i18n("fr-components-manage.ts")).toBe(true);
    expect(i18n("fr-components.ts")).toBe(false);
  });
  test("phase 27, the execution card is gone and the new deferred screens stay out of the entry", () => {
    expect(FORBIDDEN_IN_ENTRY.some((r) => r.source.includes("ExecutionCard"))).toBe(false);
    const ui = (p: string) => FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/ui/src/${p}`));
    for (const p of [
      "i18n/fr-tracking.ts",
      "dialogs/TrackingSection.tsx",
      "i18n/fr-new-project.ts",
      "i18n/fr-new-ticket.ts",
      "i18n/fr-ticket-tracking.ts",
      "dialogs/SprintSetupFields.tsx",
      "dialogs/SprintPreview.tsx",
      "dialogs/FeatureSelect.tsx",
      "shell/NotFound.tsx",
    ])
      expect(ui(p)).toBe(true);
    for (const p of ["i18n/fr.ts", "dialogs/new-project-model.ts", "pages/PageView.tsx"])
      expect(ui(p)).toBe(false);
  });
});
