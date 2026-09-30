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
  /\/components\/(graph\/src\/GraphView|kanban\/src\/Kanban|notes\/src\/NotesView|mcp-source\/src\/McpSource)\.tsx$/,
  /\/packages\/ui\/src\/(pages\/TicketTab|shell\/(TicketDetail|PresenceAvatars|ProjectPresence|KeyRequired))\.tsx$/,
  /\/packages\/ui\/src\/i18n\/fr-presence\.ts$/,
  /\/node_modules\/@tauri-apps\//,
  /\/packages\/ui\/src\/(updates\/[a-zA-Z-]+\.tsx?|i18n\/fr-updates\.ts)$/,
  /\/packages\/ui\/src\/dialogs\/(NotesDirDialog|TrustDialog|OpenViewDialog|RenamePageDialog)\.tsx$/,
  /\/packages\/sdk\/src\/ui\/(alert-dialog|confirm-dialog|reason-dialog)\.tsx$/,
  /\/packages\/ui\/src\/(ticket\/[A-Za-z-]+\.tsx?|i18n\/fr-ticket-edit\.ts)$/,
  /\/packages\/ui\/src\/(dialogs\/InstanceSettingsDialog\.tsx|i18n\/fr-widgets\.ts)$/,
  /\/packages\/ui\/src\/desktop\/install\.ts$/,
  /\/packages\/ui\/src\/settings\/(AppearancePage|SecurityPage|WebAccessCard)\.tsx$/,
  /\/packages\/ui\/src\/(settings\/ShortcutsPage\.tsx|i18n\/fr-shortcuts\.ts)$/,
  /\/packages\/ui\/src\/(desktop\/pick-folder\.ts|dialogs\/(FolderField|IconField)\.tsx|dialogs\/icon-file\.ts|i18n\/fr-fields\.ts)$/,
  /\/packages\/ui\/src\/(shell\/ScreenActions|agents\/PauseAdmission)\.tsx$/,
  /\/packages\/ui\/src\/shell\/(RunHistoryList|UserMenuContent)\.tsx$/,
  /\/packages\/ui\/src\/(settings\/WorkspacePage\.tsx|i18n\/fr-workspace\.ts)$/,
  /\/packages\/ui\/src\/(dialogs\/(EditProjectDialog|DeleteProjectDialog)\.tsx|i18n\/fr-project\.ts)$/,
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
