export type BuiltChunk = {
  fileName: string;
  isEntry: boolean;
  imports: string[];
  code: string;
  moduleIds: string[];
};
export type EntryReport = {
  files: string[];
  gzipBytes: number;
  budget: number;
  forbidden: { file: string; module: string }[];
  ok: boolean;
};
export type ReportOptions = {
  budget: number;
  forbidden: readonly RegExp[];
  gzip(bytes: Uint8Array<ArrayBuffer>): number;
};

export const ENTRY_GZIP_BUDGET = 230_000;

export const FORBIDDEN_IN_ENTRY: readonly RegExp[] = [
  /\/node_modules\/(@codemirror|@lezer|@shikijs)\//,
  /\/node_modules\/(codemirror|markdown-it|shiki|sonner|next-themes)\//,
  /\/packages\/ui\/src\/(agents\/(AgentsPage|QueuePage|AgentDrawer)|settings\/DomainsPage|components-page\/ComponentsPage|mine\/MyTicketsPage|code\/(ChangesView|ChangesBody|DiscardDialog)|files\/(FileTabView|FilePreviewSheet)|shell\/(IntegrationNotices|Welcome|PairingScreen)|pages\/SourceHeader|dialogs\/mcp-source\/McpSourceStep|ai\/[A-Za-z]+)\.tsx$/,
  /\/packages\/ui\/src\/(dialogs\/(NewProjectDialog|NewPageDialog|NewTicketDialog)|agents\/(AssignDialog|ProfileSheet)|shell\/TicketSheet|palette\/CommandPalette|components-page\/PublishDialog|onboarding\/StarterDialog)\.tsx$/,
  /\/components\/(graph\/src\/GraphView|kanban\/src\/Kanban|notes\/src\/NotesView|mcp-source\/src\/McpSource|viewer-3d\/src\/Viewer3d|snake\/src\/Snake|mockup\/src\/Mockup)\.tsx$/,
  /\/packages\/ui\/src\/(pages\/TicketTab|shell\/(TicketDetail|PresenceAvatars|ProjectPresence|KeyRequired))\.tsx$/,
  /\/packages\/ui\/src\/i18n\/fr-presence\.ts$/,
  /\/components\/questions\/src\/(QuestionsPanel|QuestionsView|QuestionsWidget)\.tsx$/,
  /\/packages\/ui\/src\/i18n\/fr-questions\.ts$/,
  /\/node_modules\/@tauri-apps\//,
  /\/packages\/ui\/src\/(updates\/[a-zA-Z-]+\.tsx?|i18n\/fr-updates\.ts)$/,
  /\/packages\/ui\/src\/dialogs\/(NotesDirDialog|TrustDialog|OpenViewDialog|RenamePageDialog)\.tsx$/,
  /\/packages\/sdk\/src\/ui\/(alert-dialog|confirm-dialog|reason-dialog)\.tsx$/,
  /\/packages\/ui\/src\/(ticket\/[A-Za-z-]+\.tsx?|i18n\/fr-(ticket-edit|labels)\.ts)$/,
  /\/packages\/ui\/src\/(dialogs\/(InstanceSettingsDialog|FrameListField)\.tsx|i18n\/fr-widgets\.ts)$/,
  /\/packages\/ui\/src\/desktop\/install\.ts$/,
  /\/packages\/ui\/src\/settings\/(AppearancePage|SecurityPage|WebAccessCard)\.tsx$/,
  /\/packages\/ui\/src\/(settings\/ShortcutsPage\.tsx|i18n\/fr-shortcuts\.ts)$/,
  /\/packages\/ui\/src\/(desktop\/pick-folder\.ts|dialogs\/(FolderField|IconField)\.tsx|dialogs\/icon-file\.ts|i18n\/fr-fields\.ts)$/,
  /\/packages\/ui\/src\/(shell\/ScreenActions|agents\/PauseAdmission)\.tsx$/,
  /\/packages\/ui\/src\/shell\/(RunHistoryList|UserMenuContent)\.tsx$/,
  /\/packages\/ui\/src\/(settings\/WorkspacePage\.tsx|i18n\/fr-workspace\.ts)$/,
  /\/packages\/ui\/src\/(dialogs\/(EditProjectDialog|DeleteProjectDialog)\.tsx|i18n\/fr-project\.ts)$/,
  /\/packages\/ui\/src\/tabs\/TabMenuContent\.tsx$/,
  /\/packages\/ui\/src\/shell\/(ProjectHeaderMenu\.tsx|project-menu\.ts)$/,
  /\/packages\/ui\/src\/shell\/shared-modules\.ts$/,
  /\/node_modules\/@radix-ui\/react-(select|radio-group)\//,
  /\/packages\/ui\/src\/(components-page\/(ComponentsFilters|UsagesSheet)\.tsx|i18n\/fr-components-list\.ts)$/,
  /\/packages\/ui\/src\/(shell\/DaemonUnreachable\.tsx|i18n\/fr-startup\.ts)$/,
  /\/packages\/ui\/src\/(files\/(FileToolbar|WrapSwitch)\.tsx|i18n\/fr-file-tools\.ts)$/,
  /\/packages\/ui\/src\/(files\/(ProjectFilesDialog|FilesDirDialog|FilesList)\.tsx|files\/(use-project-files|upload|slug)\.ts|i18n\/fr-files\.ts)$/,
  /\/packages\/ui\/src\/(settings\/SyncEmptyState\.tsx|i18n\/fr-sync-page\.ts)$/,
  /\/packages\/ui\/src\/(agents\/RunHistory\.tsx|i18n\/fr-agents-page\.ts)$/,
  /\/packages\/ui\/src\/agents\/((project-filter|project-pref)\.ts|ProjectFilter\.tsx)$/,
  /\/packages\/ui\/src\/(settings\/SettingsLayout\.tsx|code\/ChangesLayout\.tsx|components-page\/sort-pref\.ts)$/,
  /\/packages\/ui\/src\/(inbox\/[A-Za-z-]+\.tsx?|i18n\/fr-inbox\.ts|dialogs\/FileTicketDialog\.tsx)$/,
  /\/packages\/ui\/src\/(pages\/(InstanceMenuContent|LayoutEditor|LayoutToolbar|FormatMenu|EditorWidget|GridGuides|EditLayout)\.tsx|pages\/layout-draft\.ts|i18n\/fr-layout\.ts)$/,
  /\/packages\/ui\/src\/(creations\/[A-Za-z-]+\.tsx?|i18n\/fr-creations\.ts)$/,
  /\/packages\/sdk\/src\/(mock|mock-calls|mock-notes|fixtures|fixtures-glb)\.tsx?$/,
  /\/node_modules\/three\//,
  /\/packages\/sdk\/src\/(three|game)\//,
  /\/packages\/ui\/src\/ai\/(worker-backend|preview-protocol|preview-backend|draft-preview-worker|revise-escape)\.ts$/,
  /\/packages\/core\/src\/|\/node_modules\/loro-crdt\//,
  /\/packages\/ui\/src\/((about|whats-new)\/[A-Za-z-]+\.tsx?|i18n\/fr-(about|whats-new)\.ts)$/,
  /\/packages\/ui\/src\/(settings\/ApplicationCard\.tsx|desktop\/(autostart|about-event)\.ts|shell\/(HelpDialogs\.tsx|help-boot\.ts|help-labels\.ts))$/,
  /\/CHANGELOG\.md\?raw$/,
  /\/packages\/ui\/src\/(help\/ShortcutsDialog\.tsx|settings\/(ShortcutList\.tsx|shortcuts\.ts)|report\/[A-Za-z-]+\.tsx?|i18n\/fr-report\.ts)$/,
  /\/packages\/ui\/src\/(backups\/[A-Za-z-]+\.tsx?|i18n\/fr-backups\.ts|desktop\/reveal\.ts)$/,
  /\/packages\/ui\/src\/(tutorial\/[A-Za-z-]+\.tsx?|i18n\/fr-tutorial\.ts)$/,
  /\/packages\/ui\/src\/(project-agent\/[A-Za-z-]+\.tsx?|i18n\/fr-project-agent\.ts)$/,
  /\/packages\/ui\/src\/(pages\/(PendingTrust|OtherVersionMenu)|shell\/CreationsIndicator)\.tsx$/,
  /\/packages\/schema\/src\/(design-url|config-validate|design-problem)\.ts$/,
  /\/packages\/ui\/src\/(i18n\/fr-design\.ts|dialogs\/integrations\/((FigmaConnectDialog|PenpotConnectDialog)\.tsx|design-problem\.ts))$/,
  /\/packages\/ui\/src\/(shell\/sheet\/((DesignSection|DesignProperty)\.tsx|design-refs\.ts)|dialogs\/FrameField\.tsx)$/,
];

export const gzipLevel9 = (bytes: Uint8Array<ArrayBuffer>): number =>
  Bun.gzipSync(bytes, { level: 9 }).length;

export function initialChunks(chunks: readonly BuiltChunk[]): BuiltChunk[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Map<string, BuiltChunk>();
  const visit = (c: BuiltChunk) => {
    if (seen.has(c.fileName)) return;
    seen.set(c.fileName, c);
    for (const name of c.imports) {
      const next = byName.get(name);
      if (!next) throw new Error(`unknown chunk ${name}`);
      visit(next);
    }
  };
  for (const c of chunks) if (c.isEntry) visit(c);
  return [...seen.values()];
}

const DEFAULTS: ReportOptions = {
  budget: ENTRY_GZIP_BUDGET,
  forbidden: FORBIDDEN_IN_ENTRY,
  gzip: gzipLevel9,
};

export function reportEntry(chunks: readonly BuiltChunk[], opts: ReportOptions = DEFAULTS): EntryReport {
  const initial = initialChunks(chunks);
  const encoder = new TextEncoder();
  const gzipBytes = initial.reduce((n, c) => n + opts.gzip(encoder.encode(c.code)), 0);
  const forbidden = initial.flatMap((c) =>
    c.moduleIds
      .filter((id) => opts.forbidden.some((r) => r.test(id)))
      .map((module) => ({ file: c.fileName, module })),
  );
  return {
    files: initial.map((c) => c.fileName),
    gzipBytes,
    budget: opts.budget,
    forbidden,
    ok: gzipBytes <= opts.budget && forbidden.length === 0,
  };
}

export const PREVIEW_WORKER = /^workers\/draft-preview-worker-[A-Za-z0-9_-]+\.js$/;
export const FORBIDDEN_IN_MAIN_GRAPH: readonly RegExp[] = [
  /\/packages\/core\/src\//,
  /\/node_modules\/loro-crdt\//,
];

export type GraphReport = {
  previewWorker: string | null;
  forbidden: { file: string; module: string }[];
  ok: boolean;
};

export function reportGraph(chunks: readonly BuiltChunk[], emitted: readonly string[]): GraphReport {
  const previewWorker = emitted.find((name) => PREVIEW_WORKER.test(name)) ?? null;
  const forbidden = chunks.flatMap((c) =>
    c.moduleIds
      .filter((id) => FORBIDDEN_IN_MAIN_GRAPH.some((r) => r.test(id)))
      .map((module) => ({ file: c.fileName, module })),
  );
  return { previewWorker, forbidden, ok: previewWorker !== null && forbidden.length === 0 };
}
