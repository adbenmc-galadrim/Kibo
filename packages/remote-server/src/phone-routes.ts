import type { Database } from "bun:sqlite";
import { SealedRequest } from "@kibo/remote/protocol";
import { SnapshotKind } from "@kibo/remote/snapshot-kinds";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import { fail, readJson } from "./http";
import { sessionOf } from "./phone-sessions";
import type { Relay } from "./relay";
import type { SnapshotStore } from "./snapshots";

const RequestBody = z.object({ sealed: SealedRequest });
const ProjectQuery = z.object({ projectId: z.string().min(1) });
const SnapshotQuery = ProjectQuery.extend({ kind: SnapshotKind });

type PhoneRouteDeps = {
  db: Database;
  snapshots: SnapshotStore;
  relay: Relay;
  now(): number;
  upgradeEvents(req: Request): boolean;
};

function query<S extends z.ZodTypeAny>(schema: S, url: URL): z.infer<S> {
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw new KiboError("INVALID_INPUT", "missing or invalid query parameters");
  return parsed.data;
}

async function relayRequest(req: Request, relay: Relay): Promise<Response> {
  const parsed = RequestBody.safeParse(await readJson(req));
  if (!parsed.success) throw new KiboError("INVALID_INPUT", "request needs a sealed envelope");
  return Response.json({ sealed: await relay.send(parsed.data.sealed) });
}

export async function phoneRoute(
  req: Request,
  url: URL,
  deps: PhoneRouteDeps,
): Promise<Response | undefined> {
  if (!sessionOf(deps.db, req, deps.now())) return fail("UNAUTHORIZED", "no phone session");
  const route = `${req.method} ${url.pathname}`;
  switch (route) {
    case "GET /api/phone/events":
      return deps.upgradeEvents(req) ? undefined : fail("INVALID_INPUT", "websocket expected");
    case "GET /api/phone/snapshots":
      return Response.json(deps.snapshots.list(query(ProjectQuery, url).projectId));
    case "GET /api/phone/snapshot": {
      const { projectId, kind } = query(SnapshotQuery, url);
      const sealed = deps.snapshots.get(projectId, kind);
      return sealed
        ? Response.json(sealed)
        : fail("REMOTE_NOT_FOUND", `no ${kind} snapshot for ${projectId}`);
    }
    case "POST /api/phone/request":
      return relayRequest(req, deps.relay);
    default:
      return fail("NOT_FOUND", "unknown phone route");
  }
}
