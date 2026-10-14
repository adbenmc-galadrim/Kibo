import { expect, test } from "bun:test";
import { isQuestionImagePath, serveQuestionImage } from "./image-route";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const Q = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const IMG = "0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d";
const asked: [string, string][] = [];
const deps = (paired = true) => ({
  read(questionId: string, imageId: string) {
    asked.push([questionId, imageId]);
    return questionId === Q && imageId === IMG ? { bytes: PNG, mime: "image/png" } : null;
  },
  origins: () => ["http://127.0.0.1:4317"],
  hasSession: () => paired,
});
const get = (
  path: string,
  opts: { headers?: Record<string, string>; paired?: boolean; method?: string } = {},
) => {
  const url = new URL(`http://127.0.0.1:4317${path}`);
  const req = new Request(url.href, { headers: opts.headers ?? {}, method: opts.method ?? "GET" });
  return serveQuestionImage(req, url, deps(opts.paired ?? true));
};

test("only the image path of a question is routed here", () => {
  expect(isQuestionImagePath(`/api/questions/${Q}/images/${IMG}`)).toBe(true);
  expect(isQuestionImagePath(`/api/questions/${Q}/images`)).toBe(false);
  expect(isQuestionImagePath(`/api/questions/${Q}/images/${IMG}/x`)).toBe(false);
  expect(isQuestionImagePath("/api/rpc")).toBe(false);
});

test("a known image is served privately with its type and a one-day cache", async () => {
  const res = get(`/api/questions/${Q}/images/${IMG}`, { headers: { "sec-fetch-site": "same-origin" } });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
});

test("no session is 401, an unknown image 404, another site or origin 403", () => {
  const path = `/api/questions/${Q}/images/${IMG}`;
  const unpaired = get(path, { paired: false });
  expect(unpaired.status).toBe(401);
  expect(unpaired.headers.get("cache-control")).toBe("no-store");
  expect(get(`/api/questions/${Q}/images/00000000-0000-4000-8000-000000000000`).status).toBe(404);
  expect(get(path, { headers: { origin: "http://evil.test" } }).status).toBe(403);
  expect(get(path, { headers: { "sec-fetch-site": "cross-site" } }).status).toBe(403);
  expect(get(path, { method: "POST" }).status).toBe(404);
});

test("a path that tries to leave the folder of the question never reaches the disk", () => {
  asked.length = 0;
  expect(get(`/api/questions/..%2F..%2Fkibo/images/${IMG}`).status).toBe(404);
  expect(get(`/api/questions/${Q}/images/..%2F..%2Ftoken`).status).toBe(404);
  expect(get(`/api/questions/${Q}/images/%E0%A4%A`).status).toBe(404);
  expect(asked).toEqual([]);
});
