import { FAKE_PNG_BASE64 } from "./fake-mcp";

export const FAKE_FIGMA_IMAGE_HOST = "figma-alpha-api.s3.us-west-2.amazonaws.com";
export type FakeFigmaNode = { name: string; width: number; height: number; png: Uint8Array };
export type FakeFigmaFile = { name: string; version: number; nodes: Map<string, FakeFigmaNode> };
type Failure = { status: number; body: string; headers: Record<string, string> };
export type FakeFigma = {
  url: string;
  token: string;
  handle: string;
  files: Map<string, FakeFigmaFile>;
  requests: { method: string; path: string; token: string | null }[];
  rate: { remaining: number; retryAfter: number };
  addFile(fileKey: string, name: string): FakeFigmaFile;
  addNode(fileKey: string, nodeId: string, patch?: Partial<FakeFigmaNode>): FakeFigmaNode;
  bump(fileKey: string): number;
  failNext(status: number, body?: string, headers?: Record<string, string>): void;
  stop(): void;
};

const PIXEL = Uint8Array.from(Buffer.from(FAKE_PNG_BASE64, "base64"));
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const imageId = (fileKey: string, nodeId: string) => `${fileKey}-${nodeId.replace(":", "-")}`;

export function startFakeFigma(opts: { token: string; port?: number; handle?: string }): FakeFigma {
  const files = new Map<string, FakeFigmaFile>();
  const images = new Map<string, Uint8Array>();
  const requests: FakeFigma["requests"] = [];
  const rate = { remaining: 1000, retryAfter: 60 };
  let failure: Failure | null = null;
  const fileOf = (key: string) => {
    const file = files.get(key);
    if (!file) throw new Error(`fake figma: unknown file ${key}`);
    return file;
  };
  const nodes = (file: FakeFigmaFile, ids: string[]) =>
    Object.fromEntries(
      ids.map((id) => {
        const node = file.nodes.get(id);
        return [
          id,
          node
            ? {
                document: {
                  id,
                  name: node.name,
                  type: "FRAME",
                  absoluteBoundingBox: { x: 0, y: 0, width: node.width, height: node.height },
                },
              }
            : null,
        ];
      }),
    );
  const api = (req: Request, u: URL): Response => {
    if (req.headers.get("x-figma-token") !== opts.token)
      return json({ status: 403, err: "Invalid token" }, 403);
    if (rate.remaining <= 0)
      return json({ status: 429, err: "Rate limit exceeded" }, 429, {
        "retry-after": String(rate.retryAfter),
      });
    rate.remaining--;
    if (u.pathname === "/v1/me")
      return json({
        id: "1",
        handle: opts.handle ?? "adam",
        email: `${opts.handle ?? "adam"}@example.test`,
        img_url: null,
      });
    const nodesMatch = /^\/v1\/files\/([A-Za-z0-9]+)\/nodes$/.exec(u.pathname);
    if (nodesMatch?.[1]) {
      const file = files.get(nodesMatch[1]);
      if (!file) return json({ status: 404, err: "Not found" }, 404);
      const ids = (u.searchParams.get("ids") ?? "").split(",").filter(Boolean);
      return json({
        name: file.name,
        lastModified: "2026-10-05T10:00:00Z",
        version: String(file.version),
        nodes: nodes(file, ids),
      });
    }
    const imagesMatch = /^\/v1\/images\/([A-Za-z0-9]+)$/.exec(u.pathname);
    if (imagesMatch?.[1]) {
      const file = files.get(imagesMatch[1]);
      if (!file) return json({ status: 404, err: "Not found" }, 404);
      const ids = (u.searchParams.get("ids") ?? "").split(",").filter(Boolean);
      const out: Record<string, string | null> = {};
      for (const id of ids) {
        const node = file.nodes.get(id);
        if (!node) out[id] = null;
        else {
          images.set(imageId(imagesMatch[1], id), node.png);
          out[id] = `https://${FAKE_FIGMA_IMAGE_HOST}/img/${imageId(imagesMatch[1], id)}.png`;
        }
      }
      return json({ err: null, images: out });
    }
    return json({ status: 404, err: "Not found" }, 404);
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    fetch(req) {
      const u = new URL(req.url);
      requests.push({ method: req.method, path: u.pathname, token: req.headers.get("x-figma-token") });
      if (failure) {
        const f = failure;
        failure = null;
        return new Response(f.body, { status: f.status, headers: f.headers });
      }
      const img = /^\/img\/(.+)\.png$/.exec(u.pathname);
      if (img?.[1]) {
        const bytes = images.get(img[1]);
        return bytes
          ? new Response(bytes, { headers: { "content-type": "image/png" } })
          : new Response("not found", { status: 404 });
      }
      return api(req, u);
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    token: opts.token,
    handle: opts.handle ?? "adam",
    files,
    requests,
    rate,
    addFile(fileKey, name) {
      const file = { name, version: 1, nodes: new Map<string, FakeFigmaNode>() };
      files.set(fileKey, file);
      return file;
    },
    addNode(fileKey, nodeId, patch = {}) {
      const node = { name: nodeId, width: 100, height: 100, png: PIXEL, ...patch };
      fileOf(fileKey).nodes.set(nodeId, node);
      return node;
    },
    bump: (fileKey) => ++fileOf(fileKey).version,
    failNext(status, body = "", headers = {}) {
      failure = { status, body, headers };
    },
    stop: () => server.stop(true),
  };
}
