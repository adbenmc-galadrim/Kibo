import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import {
  Actor,
  type AutoLink,
  type AutoLinkEvent,
  AutoLinkReason,
  type AutoLinkRow,
  foldAutoLink,
  KiboError,
} from "@kibo/schema";
import { immediateTransaction } from "../sqlite-busy";
import { stored } from "./stored";

export type AutoLinkStore = {
  create(row: Omit<AutoLinkRow, "id">): AutoLink;
  event(id: string, e: AutoLinkEvent): AutoLink;
  list(projectId: string): AutoLink[];
  get(id: string): AutoLink | null;
  cancelled(projectId: string, from: string, to: string): boolean;
};

type LinkDbRow = {
  id: string;
  project_id: string;
  link_id: string;
  from_ticket_id: string;
  to_ticket_id: string;
  from_ticket_key: string;
  to_ticket_key: string;
  owner_run_id: string;
  other_run_id: string;
  reason: string;
  path: string;
  name: string | null;
  at: number;
};
type LinkEventDbRow = { id: number; type: string; by: string | null; at: number };

const toRow = (r: LinkDbRow): AutoLinkRow => ({
  id: r.id,
  projectId: r.project_id,
  linkId: r.link_id,
  fromTicketId: r.from_ticket_id,
  toTicketId: r.to_ticket_id,
  fromTicketKey: r.from_ticket_key,
  toTicketKey: r.to_ticket_key,
  ownerRunId: r.owner_run_id,
  otherRunId: r.other_run_id,
  reason: stored(() => AutoLinkReason.parse(r.reason), `auto link ${r.id} reason`),
  detail: { path: r.path, name: r.name },
  at: r.at,
});

const eventType = (r: LinkEventDbRow): AutoLinkEvent["type"] => {
  if (r.type === "cancelled" || r.type === "removed") return r.type;
  throw new KiboError("STORE_CORRUPT", `auto link event ${r.id} has type ${r.type}`);
};

const toEvent = (r: LinkEventDbRow): AutoLinkEvent => ({
  type: eventType(r),
  by:
    r.by === null ? null : stored(() => Actor.parse(JSON.parse(r.by ?? "")), `auto link event ${r.id} actor`),
  at: r.at,
});

export function autoLinkStore(db: Database): AutoLinkStore {
  const byId = db.query("SELECT * FROM run_auto_links WHERE id = $id");
  const eventsOf = db.query(
    "SELECT id, type, by, at FROM run_auto_link_events WHERE auto_link_id = $id ORDER BY at, id",
  );
  const insert = db.query(
    "INSERT INTO run_auto_links (id, project_id, link_id, from_ticket_id, to_ticket_id, from_ticket_key, " +
      "to_ticket_key, owner_run_id, other_run_id, reason, path, name, at) VALUES ($id, $project_id, $link_id, " +
      "$from_ticket_id, $to_ticket_id, $from_ticket_key, $to_ticket_key, $owner_run_id, $other_run_id, $reason, " +
      "$path, $name, $at)",
  );
  const insertEvent = db.query(
    "INSERT INTO run_auto_link_events (auto_link_id, type, by, at) VALUES ($id, $type, $by, $at)",
  );

  const folded = (row: LinkDbRow): AutoLink =>
    foldAutoLink(toRow(row), (eventsOf.all({ id: row.id }) as LinkEventDbRow[]).map(toEvent));
  const get = (id: string): AutoLink | null => {
    const row = byId.get({ id }) as LinkDbRow | null;
    return row ? folded(row) : null;
  };

  const event = immediateTransaction(db, (id: string, e: AutoLinkEvent): AutoLink => {
    const link = get(id);
    if (!link) throw new KiboError("NOT_FOUND", `auto link ${id} not found`);
    if (link.status !== "added") return link;
    insertEvent.run({ id, type: e.type, by: e.by ? JSON.stringify(e.by) : null, at: e.at });
    return get(id) ?? link;
  });

  return {
    create(row) {
      const id = randomUUID();
      insert.run({
        id,
        project_id: row.projectId,
        link_id: row.linkId,
        from_ticket_id: row.fromTicketId,
        to_ticket_id: row.toTicketId,
        from_ticket_key: row.fromTicketKey,
        to_ticket_key: row.toTicketKey,
        owner_run_id: row.ownerRunId,
        other_run_id: row.otherRunId,
        reason: row.reason,
        path: row.detail.path,
        name: row.detail.name,
        at: row.at,
      });
      return foldAutoLink({ ...row, id }, []);
    },
    event: (id, e) => event(id, e),
    get,
    list: (projectId) =>
      (
        db
          .query("SELECT * FROM run_auto_links WHERE project_id = $p ORDER BY at, id")
          .all({ p: projectId }) as LinkDbRow[]
      ).map(folded),
    cancelled: (projectId, from, to) =>
      db
        .query(
          "SELECT 1 FROM run_auto_links l JOIN run_auto_link_events e ON e.auto_link_id = l.id " +
            "WHERE l.project_id = $p AND l.from_ticket_id = $from AND l.to_ticket_id = $to AND e.type = 'cancelled' LIMIT 1",
        )
        .get({ p: projectId, from, to }) !== null,
  };
}
