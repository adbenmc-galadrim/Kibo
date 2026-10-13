export type LineHash = { line: number; hash: string; chars: number };

export type CodeImport = { spec: string; names: string[]; line: number };

export type IndexedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  added: number;
  removed: number;
  hash: string | null;
  exports: string[];
  imports: CodeImport[];
  lines: LineHash[];
  clipped: boolean;
};

export type WorkspaceIndex = {
  key: string;
  runIds: string[];
  baseHead: string;
  files: IndexedFile[];
  truncated: boolean;
  partial: boolean;
  at: number;
};

export type WorkspaceRun = { key: string; runId: string; startedAt: number };
