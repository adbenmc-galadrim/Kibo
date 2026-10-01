import { type Database, SQLiteError } from "bun:sqlite";
import { ComponentDraft, KiboError, ValidationReport } from "@kibo/schema";
import { isActive } from "./draft-machine";

export type DraftStore = {
  insert(d: ComponentDraft): void;
  save(d: ComponentDraft): void;
  saveReport(id: string, report: ValidationReport | null): void;
  get(id: string): ComponentDraft;
  report(id: string): ValidationReport | null;
  list(): ComponentDraft[];
  active(): ComponentDraft[];
};

type Params = {
  id: string;
  componentId: string;
  mode: string;
  title: string;
  kind: string;
  withServer: number;
  baseVersion: string | null;
  description: string;
  runId: string | null;
  sessionId: string | null;
  status: string;
  attempts: number;
  failureJson: string | null;
  incidentsJson: string;
  attachmentsJson: string;
  revisions: number;
  createdAt: number;
  updatedAt: number;
};

type UpdateParams = Pick<
  Params,
  | "id"
  | "runId"
  | "sessionId"
  | "status"
  | "attempts"
  | "failureJson"
  | "incidentsJson"
  | "attachmentsJson"
  | "revisions"
  | "updatedAt"
>;

const COLUMNS =
  "id, componentId, mode, title, kind, withServer, baseVersion, description, runId, sessionId, status, attempts, failureJson, incidentsJson, attachmentsJson, revisions, createdAt, updatedAt";

const ADDED_COLUMNS: Record<string, string> = {
  attachmentsJson: "attachmentsJson TEXT NOT NULL DEFAULT '[]'",
  revisions: "revisions INTEGER NOT NULL DEFAULT 0",
};

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new KiboError("STORE_CORRUPT", `${what} is not valid JSON: ${String(error)}`);
  }
}

function toDraft(row: Params): ComponentDraft {
  const what = `draft ${row.id}`;
  const parsed = ComponentDraft.safeParse({
    ...row,
    withServer: row.withServer === 1,
    failure: row.failureJson === null ? null : parseJson(row.failureJson, what),
    incidents: parseJson(row.incidentsJson, what),
    attachments: parseJson(row.attachmentsJson, what),
  });
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `${what} is unreadable: ${parsed.error.message}`);
  return parsed.data;
}

const toParams = (d: ComponentDraft): Params => ({
  id: d.id,
  componentId: d.componentId,
  mode: d.mode,
  title: d.title,
  kind: d.kind,
  withServer: d.withServer ? 1 : 0,
  baseVersion: d.baseVersion,
  description: d.description,
  runId: d.runId,
  sessionId: d.sessionId,
  status: d.status,
  attempts: d.attempts,
  failureJson: d.failure === null ? null : JSON.stringify(d.failure),
  incidentsJson: JSON.stringify(d.incidents),
  attachmentsJson: JSON.stringify(d.attachments),
  revisions: d.revisions,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const toUpdateParams = (p: Params): UpdateParams => ({
  id: p.id,
  runId: p.runId,
  sessionId: p.sessionId,
  status: p.status,
  attempts: p.attempts,
  failureJson: p.failureJson,
  incidentsJson: p.incidentsJson,
  attachmentsJson: p.attachmentsJson,
  revisions: p.revisions,
  updatedAt: p.updatedAt,
});

function addMissingColumns(db: Database): void {
  const present = new Set(
    db
      .query<{ name: string }, []>("PRAGMA table_info(component_drafts)")
      .all()
      .map((c) => c.name),
  );
  for (const [name, definition] of Object.entries(ADDED_COLUMNS))
    if (!present.has(name)) db.run(`ALTER TABLE component_drafts ADD COLUMN ${definition}`);
}

export function openDraftStore(db: Database): DraftStore {
  db.run(`CREATE TABLE IF NOT EXISTS component_drafts (
    id TEXT PRIMARY KEY, componentId TEXT NOT NULL, mode TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL,
    withServer INTEGER NOT NULL, baseVersion TEXT, description TEXT NOT NULL, runId TEXT, sessionId TEXT,
    status TEXT NOT NULL, attempts INTEGER NOT NULL, failureJson TEXT, incidentsJson TEXT NOT NULL,
    reportJson TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL,
    attachmentsJson TEXT NOT NULL DEFAULT '[]', revisions INTEGER NOT NULL DEFAULT 0)`);
  addMissingColumns(db);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS component_drafts_one_active ON component_drafts (componentId)
    WHERE status NOT IN ('done', 'abandoned')`);
  const insert = db.query<null, Params>(
    `INSERT INTO component_drafts (${COLUMNS}) VALUES ($id, $componentId, $mode, $title, $kind, $withServer, $baseVersion, $description, $runId, $sessionId, $status, $attempts, $failureJson, $incidentsJson, $attachmentsJson, $revisions, $createdAt, $updatedAt)`,
  );
  const update = db.query<null, UpdateParams>(
    "UPDATE component_drafts SET runId = $runId, sessionId = $sessionId, status = $status, attempts = $attempts, failureJson = $failureJson, incidentsJson = $incidentsJson, attachmentsJson = $attachmentsJson, revisions = $revisions, updatedAt = $updatedAt WHERE id = $id",
  );
  const writeReport = db.query<null, { id: string; reportJson: string | null }>(
    "UPDATE component_drafts SET reportJson = $reportJson WHERE id = $id",
  );
  const one = db.query<Params, { id: string }>(`SELECT ${COLUMNS} FROM component_drafts WHERE id = $id`);
  const oneReport = db.query<{ reportJson: string | null }, { id: string }>(
    "SELECT reportJson FROM component_drafts WHERE id = $id",
  );
  const all = db.query<Params, []>(`SELECT ${COLUMNS} FROM component_drafts ORDER BY updatedAt DESC, id`);

  const get = (id: string): ComponentDraft => {
    const row = one.get({ id });
    if (!row) throw new KiboError("NOT_FOUND", `draft ${id} not found`);
    return toDraft(row);
  };
  const reportRow = (id: string) => {
    const row = oneReport.get({ id });
    if (!row) throw new KiboError("NOT_FOUND", `draft ${id} not found`);
    return row;
  };
  const list = () => all.all().map(toDraft);

  return {
    insert: (d) => {
      try {
        insert.run(toParams(d));
      } catch (e) {
        if (e instanceof SQLiteError && e.code === "SQLITE_CONSTRAINT_UNIQUE")
          throw new KiboError("CONFLICT", `a draft of ${d.componentId} is already open`);
        throw e;
      }
    },
    save: (d) => {
      get(d.id);
      update.run(toUpdateParams(toParams(d)));
    },
    saveReport: (id, report) => {
      reportRow(id);
      writeReport.run({ id, reportJson: report === null ? null : JSON.stringify(report) });
    },
    get,
    report: (id) => {
      const { reportJson } = reportRow(id);
      if (reportJson === null) return null;
      const parsed = ValidationReport.safeParse(parseJson(reportJson, `report of draft ${id}`));
      if (!parsed.success) throw new KiboError("STORE_CORRUPT", `report of draft ${id} is unreadable`);
      return parsed.data;
    },
    list,
    active: () => list().filter(isActive),
  };
}
