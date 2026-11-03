import { SealedRequest } from "@kibo/remote/protocol";
import { SnapshotKind } from "@kibo/remote/snapshot-kinds";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import { fail, readJson } from "./http";
import { authHandler, type PhoneAuthDeps } from "./phone-auth-routes";
import { renewSession, sessionCookie, sessionOf } from "./phone-sessions";
import type { Relay } from "./relay";
import type { SnapshotStore } from "./snapshots";

const REQUEST_MAX_BYTES = 16 * 1_048_576;

const RequestBody = z.object({ sealed: SealedRequest });
const ProjectQuery = z.object({ projectId: z.string().min(1) });
const SnapshotQuery = ProjectQuery.extend({ kind: SnapshotKind });

const EVENTS = "GET /api/phone/events";

type PhoneRouteDeps = PhoneAuthDeps & {
  snapshots: SnapshotStore;
  relay: Relay;
  origin: string;
  upgradeEvents(req: Request, headers: Record<string, string>): boolean;
};

function query<S extends z.ZodTypeAny>(schema: S, url: URL): z.infer<S> {
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw new KiboError("INVALID_INPUT", "missing or invalid query parameters");
  return parsed.data;
}

async function relayRequest(req: Request, relay: Relay): Promise<Response> {
  const parsed = RequestBody.safeParse(await readJson(req, REQUEST_MAX_BYTES));
  if (!parsed.success) throw new KiboError("INVALID_INPUT", "request needs a sealed envelope");
  return Response.json({ sealed: await relay.send(parsed.data.sealed) });
}

const writesOrListens = (req: Request, route: string) => req.method !== "GET" || route === EVENTS;

function withCookie(res: Response | undefined, cookie: Record<string, string>): Response | undefined {
  for (const [name, value] of Object.entries(cookie)) res?.headers.set(name, value);
  return res;
}

async function sessionRoute(
  req: Request,
  url: URL,
  route: string,
  deps: PhoneRouteDeps,
  session: { expiresAt: number },
  cookie: Record<string, string>,
): Promise<Response | undefined> {
  switch (route) {
    case EVENTS:
      return deps.upgradeEvents(req, cookie) ? undefined : fail("INVALID_INPUT", "websocket expected");
    case "GET /api/phone/session":
      return Response.json({ ok: true, expiresAt: session.expiresAt });
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

export async function phoneRoute(
  req: Request,
  url: URL,
  deps: PhoneRouteDeps,
): Promise<Response | undefined> {
  const route = `${req.method} ${url.pathname}`;
  const sameOrigin = req.headers.get("origin") === deps.origin;
  const auth = authHandler(route);
  if (auth) return sameOrigin ? auth(req, deps) : fail("FORBIDDEN", "origin not allowed");
  const now = deps.now();
  const session = sessionOf(deps.db, req, now);
  if (!session) return fail("UNAUTHORIZED", "no phone session");
  if (writesOrListens(req, route) && !sameOrigin) return fail("FORBIDDEN", "origin not allowed");
  const renewed = renewSession(deps.db, session, now);
  const cookie: Record<string, string> = renewed ? { "set-cookie": sessionCookie(renewed.token) } : {};
  const res = await sessionRoute(req, url, route, deps, renewed ?? session, cookie);
  return withCookie(res, cookie);
}
