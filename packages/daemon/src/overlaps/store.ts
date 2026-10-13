import { randomUUID } from "node:crypto";
import type { Finding } from "@kibo/core";
import {
  Actor,
  foldOverlap,
  KiboError,
  type Overlap,
  OverlapDetail,
  type OverlapEvent,
  type OverlapIgnore,
  OverlapKind,
  OverlapRole,
  type OverlapRow,
  type OverlapStatus,
  type RunOverlapCount,
} from "@kibo/schema";
import { immediateTransaction } from "../sqlite-busy";
import { type AutoLinkStore, autoLinkStore } from "./auto-link-store";
import { openOverlapDatabase } from "./store-schema";
import { stored } from "./stored";

export type OverlapQuery = { projectId?: string; runId?: string; state?: OverlapStatus };

export type OverlapStore = {
  create(f: Finding, projectId: string, at: number): Overlap;
  touch(ids: string[], at: number): void;
  event(id: string, e: OverlapEvent): Overlap;
  open(projectId: string): Overlap[];
  list(q: OverlapQuery): Overlap[];
  get(id: string): Overlap | null;
  pending(runId: string): { overlap: Overlap; role: OverlapRole }[];
  ignore(projectId: string, kind: OverlapKind, key: string, label: string, by: Actor, at: number): void;
  reactivate(projectId: string, kind: OverlapKind, key: string): void;
  ignored(projectId: string): OverlapIgnore[];
  ignoredKeys(projectId: string): Set<string>;
  openCountByRun(): RunOverlapCount[];
  openTotal(): number;
  autoLink: AutoLinkStore;
  close(): void;
};

type OverlapDbRow = {
  id: string;
  project_id: string;
  kind: string;
  key: string;
  owner_run_id: string;
  other_run_id: string;
  owner_workspace: string;
  other_workspace: string;
  detail: string;
  first_seen_at: number;
  last_seen_at: number;
};
type EventDbRow = { id: number; type: string; role: string | null; by: string | null; at: number };
type IgnoreDbRow = { project_id: string; kind: string; key: string; label: string; by: string; at: number };

const actorOf = (raw: string, what: string): Actor => stored(() => Actor.parse(JSON.parse(raw)), what);

const toRow = (r: OverlapDbRow): OverlapRow => ({
  id: r.id,
  projectId: r.project_id,
  kind: stored(() => OverlapKind.parse(r.kind), `overlap ${r.id} kind`),
  key: r.key,
  ownerRunId: r.owner_run_id,
  otherRunId: r.other_run_id,
  ownerWorkspace: r.owner_workspace,
  otherWorkspace: r.other_workspace,
  detail: stored(() => OverlapDetail.parse(JSON.parse(r.detail)), `overlap ${r.id} detail`),
  firstSeenAt: r.first_seen_at,
});

const eventType = (r: EventDbRow): OverlapEvent["type"] => {
  if (r.type === "delivered" || r.type === "resolved" || r.type === "ignored") return r.type;
  throw new KiboError("STORE_CORRUPT", `overlap event ${r.id} has type ${r.type}`);
};

const toEvent = (r: EventDbRow): OverlapEvent => ({
  type: eventType(r),
  role: r.role === null ? null : stored(() => OverlapRole.parse(r.role), `overlap event ${r.id} role`),
  by: r.by === null ? null : actorOf(r.by, `overlap event ${r.id} actor`),
  at: r.at,
});

const toIgnore = (r: IgnoreDbRow): OverlapIgnore => ({
  projectId: r.project_id,
  kind: stored(() => OverlapKind.parse(r.kind), `ignored overlap ${r.key} kind`),
  key: r.key,
  label: r.label,
  by: actorOf(r.by, `ignored overlap ${r.key} actor`),
  at: r.at,
});

const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Error && e.message.includes("UNIQUE constraint failed");

const changes = (o: Overlap, e: OverlapEvent): boolean => {
  if (o.status !== "open") return false;
  if (e.type !== "delivered") return true;
  return (e.role === "owner" ? o.ownerDeliveredAt : o.deliveredAt) === null && e.role !== null;
};

const roleOf = (o: Overlap, runId: string): OverlapRole => (o.ownerRunId === runId ? "owner" : "other");
const delivered = (o: Overlap, role: OverlapRole): boolean =>
  (role === "owner" ? o.ownerDeliveredAt : o.deliveredAt) !== null;

export function openOverlapStore(home: string): OverlapStore {
  const db = openOverlapDatabase(home);
  const byId = db.query("SELECT * FROM run_overlaps WHERE id = $id");
  const eventsOf = db.query(
    "SELECT id, type, role, by, at FROM run_overlap_events WHERE overlap_id = $id ORDER BY at, id",
  );
  const insert = db.query(
    "INSERT INTO run_overlaps (id, project_id, kind, key, owner_run_id, other_run_id, owner_workspace, " +
      "other_workspace, detail, first_seen_at, last_seen_at, open) VALUES ($id, $project_id, $kind, $key, " +
      "$owner_run_id, $other_run_id, $owner_workspace, $other_workspace, $detail, $at, $at, 1)",
  );
  const insertEvent = db.query(
    "INSERT INTO run_overlap_events (overlap_id, type, role, by, at) VALUES ($id, $type, $role, $by, $at)",
  );
  const close = db.query("UPDATE run_overlaps SET open = 0 WHERE id = $id");
  const touchOne = db.query(
    "UPDATE run_overlaps SET last_seen_at = $at WHERE id = $id AND last_seen_at < $at",
  );

  const folded = (row: OverlapDbRow): Overlap =>
    foldOverlap(toRow(row), row.last_seen_at, (eventsOf.all({ id: row.id }) as EventDbRow[]).map(toEvent));
  const get = (id: string): Overlap | null => {
    const row = byId.get({ id }) as OverlapDbRow | null;
    return row ? folded(row) : null;
  };
  const many = (sql: string, params: Record<string, string>): Overlap[] =>
    (
      db
        .query(`SELECT * FROM run_overlaps WHERE ${sql} ORDER BY first_seen_at, id`)
        .all(params) as OverlapDbRow[]
    ).map(folded);
  const activeIgnores = (projectId: string): IgnoreDbRow[] =>
    db
      .query("SELECT * FROM run_overlap_ignores WHERE project_id = $p AND active = 1 ORDER BY at, id")
      .all({ p: projectId }) as IgnoreDbRow[];

  function create(f: Finding, projectId: string, at: number): Overlap {
    const id = randomUUID();
    try {
      insert.run({
        id,
        project_id: projectId,
        kind: f.kind,
        key: f.key,
        owner_run_id: f.ownerRunId,
        other_run_id: f.otherRunId,
        owner_workspace: f.ownerWorkspace,
        other_workspace: f.otherWorkspace,
        detail: JSON.stringify(f.detail),
        at,
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new KiboError("CONFLICT", `overlap ${f.key} is already open`);
      throw e;
    }
    return foldOverlap({ ...f, id, projectId, firstSeenAt: at }, at, []);
  }

  const event = immediateTransaction(db, (id: string, e: OverlapEvent): Overlap => {
    const overlap = get(id);
    if (!overlap) throw new KiboError("NOT_FOUND", `overlap ${id} not found`);
    if (!changes(overlap, e)) return overlap;
    insertEvent.run({ id, type: e.type, role: e.role, by: e.by ? JSON.stringify(e.by) : null, at: e.at });
    if (e.type !== "delivered") close.run({ id });
    return get(id) ?? overlap;
  });

  const touch = immediateTransaction(db, (ids: string[], at: number): void => {
    for (const id of ids) touchOne.run({ id, at });
  });

  const ignore = immediateTransaction(
    db,
    (projectId: string, kind: OverlapKind, key: string, label: string, by: Actor, at: number): void => {
      if (activeIgnores(projectId).some((r) => r.kind === kind && r.key === key)) return;
      db.query(
        "INSERT INTO run_overlap_ignores (project_id, kind, key, label, by, at, active) VALUES ($p, $kind, $key, $label, $by, $at, 1)",
      ).run({ p: projectId, kind, key, label, by: JSON.stringify(by), at });
    },
  );

  return {
    create,
    touch: (ids, at) => touch(ids, at),
    event: (id, e) => event(id, e),
    open: (projectId) => many("project_id = $p AND open = 1", { p: projectId }),
    list(q) {
      const where = ["1 = 1"];
      const params: Record<string, string> = {};
      if (q.projectId !== undefined) {
        where.push("project_id = $p");
        params.p = q.projectId;
      }
      if (q.runId !== undefined) {
        where.push("(owner_run_id = $r OR other_run_id = $r)");
        params.r = q.runId;
      }
      const all = many(where.join(" AND "), params);
      return q.state === undefined ? all : all.filter((o) => o.status === q.state);
    },
    get,
    pending: (runId) =>
      many("open = 1 AND (owner_run_id = $r OR other_run_id = $r)", { r: runId })
        .map((overlap) => ({ overlap, role: roleOf(overlap, runId) }))
        .filter(({ overlap, role }) => !delivered(overlap, role)),
    ignore: (projectId, kind, key, label, by, at) => ignore(projectId, kind, key, label, by, at),
    reactivate(projectId, kind, key) {
      db.query(
        "UPDATE run_overlap_ignores SET active = 0 WHERE project_id = $p AND kind = $kind AND key = $key",
      ).run({
        p: projectId,
        kind,
        key,
      });
    },
    ignored: (projectId) => activeIgnores(projectId).map(toIgnore),
    ignoredKeys: (projectId) => new Set(activeIgnores(projectId).map((r) => r.key)),
    openCountByRun: () =>
      db
        .query(
          "SELECT run_id AS runId, COUNT(*) AS open FROM (SELECT owner_run_id AS run_id FROM run_overlaps WHERE open = 1 " +
            "UNION ALL SELECT other_run_id FROM run_overlaps WHERE open = 1) GROUP BY run_id ORDER BY run_id",
        )
        .all() as RunOverlapCount[],
    openTotal: () =>
      (db.query("SELECT COUNT(*) AS n FROM run_overlaps WHERE open = 1").get() as { n: number }).n,
    autoLink: autoLinkStore(db),
    close: () => db.close(),
  };
}
