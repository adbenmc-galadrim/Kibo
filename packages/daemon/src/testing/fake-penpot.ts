import { randomUUID } from "node:crypto";
import { FAKE_PNG_BASE64 } from "./fake-mcp";

export type FakePenpotBoard = {
  name: string;
  width: number;
  height: number;
  mediaId: string | null;
  image: Uint8Array;
  mime: "image/png" | "image/webp";
};
export type FakePenpotFile = { name: string; pages: Map<string, Map<string, FakePenpotBoard>> };
type Failure = { status: number; body: string };
export type FakePenpot = {
  url: string;
  token: string;
  fullname: string;
  files: Map<string, FakePenpotFile>;
  requests: { method: string; path: string; auth: string | null; body: string }[];
  redirectAssets: boolean;
  offline: boolean;
  addBoard(
    fileId: string,
    pageId: string,
    boardId: string,
    patch?: Partial<FakePenpotBoard>,
  ): FakePenpotBoard;
  rerender(fileId: string, pageId: string, boardId: string): string;
  failNext(status: number, body?: string): void;
  stop(): void;
};

export const PENPOT_IDS = {
  team: "11111111-1111-4111-8111-111111111111",
  project: "22222222-2222-4222-8222-222222222222",
  file: "33333333-3333-4333-8333-333333333333",
  page: "44444444-4444-4444-8444-444444444444",
  board: "55555555-5555-4555-8555-555555555555",
};

export const penpotBoardUrl = (instance: string, ids: typeof PENPOT_IDS = PENPOT_IDS): string =>
  `${instance}/#/workspace/${ids.team}/${ids.project}/${ids.file}?page-id=${ids.page}&board-id=${ids.board}`;

const PIXEL = Uint8Array.from(Buffer.from(FAKE_PNG_BASE64, "base64"));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const notFound = () => json({ type: "not-found", code: "object-not-found" }, 404);

const field = (body: unknown, key: string): string | null => {
  if (typeof body !== "object" || body === null) return null;
  const value: unknown = Reflect.get(body, key);
  return typeof value === "string" ? value : null;
};

const parseBody = (text: string): { ok: true; value: unknown } | { ok: false } => {
  if (text === "") return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

export function startFakePenpot(opts: { token: string; port?: number; fullname?: string }): FakePenpot {
  const files = new Map<string, FakePenpotFile>();
  const requests: FakePenpot["requests"] = [];
  let failure: Failure | null = null;
  const fullname = opts.fullname ?? "Adam";

  const boardOf = (fileId: string | null, pageId: string | null, boardId: string | null) =>
    fileId && pageId && boardId ? (files.get(fileId)?.pages.get(pageId)?.get(boardId) ?? null) : null;
  const boardByMedia = (mediaId: string) => {
    for (const file of files.values())
      for (const page of file.pages.values())
        for (const board of page.values()) if (board.mediaId === mediaId) return board;
    return null;
  };

  const getPage = (body: unknown) => {
    const pageId = field(body, "page-id");
    const boardId = field(body, "object-id");
    const board = boardOf(field(body, "file-id"), pageId, boardId);
    if (!board || !boardId) return notFound();
    const { name, width, height } = board;
    const object = {
      id: boardId,
      type: "frame",
      name,
      width,
      height,
      selrect: { x: 0, y: 0, width, height },
    };
    return json({ id: pageId, name: "Page 1", objects: { [boardId]: object } });
  };

  const thumbnails = (body: unknown) => {
    const fileId = field(body, "file-id");
    const file = fileId ? files.get(fileId) : undefined;
    if (!fileId || !file) return notFound();
    const map: Record<string, string> = {};
    for (const [pageId, page] of file.pages)
      for (const [boardId, board] of page)
        if (board.mediaId !== null) map[`${fileId}/${pageId}/${boardId}/frame`] = board.mediaId;
    return json(map);
  };

  const command = (req: Request, name: string, body: unknown): Response => {
    if (req.headers.get("authorization") !== `Token ${opts.token}`)
      return json({ type: "authentication", code: "unauthorized" }, 401);
    if (name === "get-profile") return json({ id: randomUUID(), fullname, email: "adam@example.test" });
    if (name === "get-page") return getPage(body);
    if (name === "get-file-object-thumbnails") return thumbnails(body);
    return notFound();
  };

  const asset = (mediaId: string, viaStorage: boolean) => {
    const board = boardByMedia(mediaId);
    if (!board) return new Response("not found", { status: 404 });
    if (state.redirectAssets && !viaStorage)
      return new Response(null, { status: 307, headers: { location: `${url}/storage/${mediaId}` } });
    return new Response(board.image, { headers: { "content-type": board.mime } });
  };

  const route = async (req: Request, u: URL, text: string): Promise<Response> => {
    const rpc = /^\/api\/rpc\/command\/([a-z-]+)$/.exec(u.pathname);
    if (rpc?.[1] && req.method === "POST") {
      const parsed = parseBody(text);
      if (!parsed.ok) return json({ type: "validation", code: "malformed-json" }, 400);
      return command(req, rpc[1], parsed.value);
    }
    const byId = /^\/assets\/by-id\/([0-9a-f-]+)$/.exec(u.pathname);
    if (byId?.[1] && req.method === "GET") return asset(byId[1], false);
    const storage = /^\/storage\/([0-9a-f-]+)$/.exec(u.pathname);
    if (storage?.[1] && req.method === "GET") return asset(storage[1], true);
    return notFound();
  };

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    async fetch(req) {
      const u = new URL(req.url);
      const text = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
      requests.push({
        method: req.method,
        path: u.pathname,
        auth: req.headers.get("authorization"),
        body: text,
      });
      if (req.method === "POST" && u.pathname === "/__test/offline") {
        state.offline = true;
        return new Response(null, { status: 204 });
      }
      if (req.method === "POST" && u.pathname === "/__test/online") {
        state.offline = false;
        return new Response(null, { status: 204 });
      }
      if (state.offline) return new Response("service unavailable", { status: 503 });
      if (failure) {
        const f = failure;
        failure = null;
        return new Response(f.body, { status: f.status });
      }
      return route(req, u, text);
    },
  });
  const url = `http://127.0.0.1:${server.port}`;

  const state: FakePenpot = {
    url,
    token: opts.token,
    fullname,
    files,
    requests,
    redirectAssets: false,
    offline: false,
    addBoard(fileId, pageId, boardId, patch = {}) {
      const file = files.get(fileId) ?? {
        name: "Kibo",
        pages: new Map<string, Map<string, FakePenpotBoard>>(),
      };
      files.set(fileId, file);
      const page = file.pages.get(pageId) ?? new Map<string, FakePenpotBoard>();
      file.pages.set(pageId, page);
      const board: FakePenpotBoard = {
        name: boardId,
        width: 100,
        height: 100,
        mediaId: randomUUID(),
        image: PIXEL,
        mime: "image/png",
        ...patch,
      };
      page.set(boardId, board);
      return board;
    },
    rerender(fileId, pageId, boardId) {
      const board = boardOf(fileId, pageId, boardId);
      if (!board) throw new Error(`fake penpot: unknown board ${boardId}`);
      const mediaId = randomUUID();
      board.mediaId = mediaId;
      return mediaId;
    },
    failNext(status, body = "") {
      failure = { status, body };
    },
    stop: () => server.stop(true),
  };
  return state;
}
