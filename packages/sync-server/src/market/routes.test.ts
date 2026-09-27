import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { owned } from "@kibo/trust";
import { BASE, codeOf, errorOf, json, PUBLISH, REVOKE, RouteKit } from "./route-test-kit";

let r: RouteKit;

beforeEach(async () => {
  r = await RouteKit.create("kibo-market-routes-");
});
afterEach(() => r.close());

describe("reading", () => {
  test("unrelated paths are not handled", async () => {
    expect(await r.get("/v1/sync")).toBeNull();
  });
  test("a signed publication is accepted and served back byte for byte", async () => {
    const { bytes } = await r.pkg();
    const res = await r.route(await r.signed(PUBLISH, bytes));
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ ok: true, result: { serial: 2 } });
    const { bytes: expected, sig } = r.deps.market.index();
    const index = await r.get("/market/index.json");
    expect(new Uint8Array(await (index as Response).arrayBuffer())).toEqual(owned(expected));
    expect(await (await r.get("/market/index.json.sig"))?.text()).toBe(sig);
    const file = await r.get("/market/packages/burndown/0.3.0.kpkg");
    expect(new Uint8Array(await (file as Response).arrayBuffer())).toEqual(owned(bytes));
  });
  test("the index carries its serial as ETag and answers 304 when unchanged", async () => {
    for (const path of ["/market/index.json", "/market/index.json.sig"]) {
      expect((await r.get(path))?.headers.get("etag")).toBe('"1"');
      const unchanged = await r.get(path, { "if-none-match": 'W/"0", "1"' });
      expect(unchanged?.status).toBe(304);
      expect(await unchanged?.text()).toBe("");
    }
    await r.route(await r.signed(PUBLISH, (await r.pkg()).bytes));
    const changed = await r.get("/market/index.json", { "if-none-match": '"1"' });
    expect(changed?.status).toBe(200);
    expect(changed?.headers.get("etag")).toBe('"2"');
  });
  test("a missing or malformed package path is 404", async () => {
    expect((await r.get("/market/packages/nope/1.0.0.kpkg"))?.status).toBe(404);
    expect((await r.get("/market/packages/Nope/1.0.kpkg"))?.status).toBe(404);
  });
  test("an internal failure is 500 without details", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    r.kit.sdb.db.exec("DELETE FROM market_state");
    const res = await r.get("/market/index.json");
    expect(res?.status).toBe(500);
    expect(await errorOf(res)).toEqual({ code: "INTERNAL", message: "internal error" });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe("writing", () => {
  test("a user without role is 403", async () => {
    r.deps.market.ungrant(r.device.userId);
    expect((await r.route(await r.signed(PUBLISH, (await r.pkg()).bytes)))?.status).toBe(403);
  });
  test("a new publisher key without its claim header is 422", async () => {
    const req = await r.signed(PUBLISH, (await r.pkg()).bytes);
    req.headers.delete("x-kibo-publisher-claim");
    const res = await r.route(req);
    expect(res?.status).toBe(422);
    expect(await codeOf(res)).toBe("SIGNATURE_INVALID");
  });
  test("the publisher revokes through the API", async () => {
    const { bytes, pkg } = await r.pkg();
    await r.route(await r.signed(PUBLISH, bytes));
    const body = json({ hash: pkg.hash, reason: "faille" });
    const res = await r.route(
      await r.signed(REVOKE, body, { headers: { "content-type": "application/json" } }),
    );
    expect(await res?.json()).toEqual({ ok: true, result: { serial: 3 } });
  });
  test("a malformed revocation is 400", async () => {
    const notJson = await r.route(await r.signed(REVOKE, new TextEncoder().encode("{")));
    expect(await codeOf(notJson)).toBe("INVALID_INPUT");
    const badHash = await r.route(await r.signed(REVOKE, json({ hash: "zz", reason: "x" })));
    expect(await codeOf(badHash)).toBe("INVALID_INPUT");
  });
  test("the same version twice is 409", async () => {
    await r.route(await r.signed(PUBLISH, (await r.pkg()).bytes));
    const again = await r.pkg({ files: { "extra.ts": "export const y = 2;\n" } });
    const res = await r.route(await r.signed(PUBLISH, again.bytes));
    expect(res?.status).toBe(409);
    expect(await codeOf(res)).toBe("VERSION_EXISTS");
  });
  test("a tampered package is 422", async () => {
    const { pkg } = await r.pkg();
    const tampered = json({ ...pkg, files: pkg.files.map((f) => ({ ...f, sha256: "0".repeat(64) })) });
    const res = await r.route(await r.signed(PUBLISH, tampered));
    expect(res?.status).toBe(422);
    expect(await codeOf(res)).toBe("HASH_MISMATCH");
  });
  test("an unsigned publication is 401", async () => {
    const { bytes } = await r.pkg();
    const res = await r.route(new Request(`${BASE}${PUBLISH}`, { method: "POST", body: owned(bytes) }));
    expect(res?.status).toBe(401);
  });
});
