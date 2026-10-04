import { afterEach, beforeEach, expect, test } from "bun:test";
import { type FakePenpot, PENPOT_IDS, penpotBoardUrl, startFakePenpot } from "./fake-penpot";

let penpot: FakePenpot;
const rpc = (command: string, body: unknown, token = penpot.token) =>
  fetch(`${penpot.url}/api/rpc/command/${command}`, {
    method: "POST",
    headers: {
      authorization: `Token ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  penpot = startFakePenpot({ token: "penpot-test-token", fullname: "Adam" });
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board, {
    name: "Accueil",
    width: 1440,
    height: 900,
  });
});
afterEach(() => penpot.stop());
const thumbnails = () => rpc("get-file-object-thumbnails", { "file-id": PENPOT_IDS.file });

test("get-profile needs the Token header", async () => {
  expect((await rpc("get-profile", {}, "wrong")).status).toBe(401);
  expect(await (await rpc("get-profile", {})).json()).toMatchObject({ fullname: "Adam" });
});

test("get-page returns the board subtree", async () => {
  const res = await rpc("get-page", {
    "file-id": PENPOT_IDS.file,
    "page-id": PENPOT_IDS.page,
    "object-id": PENPOT_IDS.board,
  });
  const page = (await res.json()) as {
    objects: Record<string, { name: string; width: number; height: number; type: string }>;
  };
  expect(page.objects[PENPOT_IDS.board]).toMatchObject({
    name: "Accueil",
    width: 1440,
    height: 900,
    type: "frame",
  });
  expect(
    (
      await rpc("get-page", {
        "file-id": PENPOT_IDS.file,
        "page-id": PENPOT_IDS.page,
        "object-id": PENPOT_IDS.team,
      })
    ).status,
  ).toBe(404);
});

test("thumbnails map a board to a media id, served as a public asset", async () => {
  const res = await rpc("get-file-object-thumbnails", { "file-id": PENPOT_IDS.file });
  const map = (await res.json()) as Record<string, string>;
  const key = `${PENPOT_IDS.file}/${PENPOT_IDS.page}/${PENPOT_IDS.board}/frame`;
  const mediaId = map[key];
  expect(mediaId).toBeDefined();
  const asset = await fetch(`${penpot.url}/assets/by-id/${mediaId}`);
  expect(asset.status).toBe(200);
  expect(asset.headers.get("content-type")).toBe("image/png");
  const next = penpot.rerender(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board);
  expect(next).not.toBe(mediaId);
  const after = (await (await thumbnails()).json()) as Record<string, string>;
  expect(after[key]).toBe(next);
  expect((await fetch(`${penpot.url}/assets/by-id/${mediaId}`)).status).toBe(404);
  expect((await fetch(`${penpot.url}/assets/by-id/${next}`)).status).toBe(200);
});

test("a board never opened has no thumbnail", async () => {
  const unopened = "66666666-6666-4666-8666-666666666666";
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, unopened, { mediaId: null });
  const map = (await (await thumbnails()).json()) as Record<string, string>;
  expect(Object.keys(map)).toEqual([`${PENPOT_IDS.file}/${PENPOT_IDS.page}/${PENPOT_IDS.board}/frame`]);
});

test("malformed json answers 400, an unknown command 404", async () => {
  const malformed = await fetch(`${penpot.url}/api/rpc/command/get-profile`, {
    method: "POST",
    headers: { authorization: `Token ${penpot.token}`, "content-type": "application/json" },
    body: "{not json",
  });
  expect(malformed.status).toBe(400);
  expect((await rpc("get-nothing", {})).status).toBe(404);
});

test("failNext is consumed once and can carry headers", async () => {
  penpot.failNext(429, "slow down", { "retry-after": "2" });
  const limited = await rpc("get-profile", {});
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("2");
  expect(await limited.text()).toBe("slow down");
  expect((await rpc("get-profile", {})).status).toBe(200);
});

test("offline wins over a pending failure", async () => {
  penpot.failNext(500, "boom");
  await fetch(`${penpot.url}/__test/offline`, { method: "POST" });
  expect((await rpc("get-profile", {})).status).toBe(503);
  await fetch(`${penpot.url}/__test/online`, { method: "POST" });
  expect((await rpc("get-profile", {})).status).toBe(500);
  expect((await rpc("get-profile", {})).status).toBe(200);
});

test("assets can redirect like an s3 backend, and offline answers 503", async () => {
  penpot.redirectAssets = true;
  const map = (await (
    await rpc("get-file-object-thumbnails", { "file-id": PENPOT_IDS.file })
  ).json()) as Record<string, string>;
  const asset = await fetch(`${penpot.url}/assets/by-id/${Object.values(map)[0]}`, { redirect: "manual" });
  expect(asset.status).toBe(307);
  expect(asset.headers.get("location")).toBe(`${penpot.url}/storage/${Object.values(map)[0]}`);
  await fetch(`${penpot.url}/__test/offline`, { method: "POST" });
  expect((await rpc("get-profile", {})).status).toBe(503);
  await fetch(`${penpot.url}/__test/online`, { method: "POST" });
  expect((await rpc("get-profile", {})).status).toBe(200);
  expect(penpotBoardUrl(penpot.url)).toBe(
    `${penpot.url}/#/workspace/${PENPOT_IDS.team}/${PENPOT_IDS.project}/${PENPOT_IDS.file}?page-id=${PENPOT_IDS.page}&board-id=${PENPOT_IDS.board}`,
  );
});
