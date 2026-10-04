import { expect, test } from "bun:test";
import { createMockSdk } from "./mock";
import { defineServer } from "./server";

const base = { id: "probe", version: "0.1.0", kind: "widget" as const, title: "Probe" };

test("every attempt is recorded in used, denials also in violations", async () => {
  const m = createMockSdk({ ...base, reads: ["ticket"], writes: [] });
  await m.sdk.list("ticket");
  await expect(m.sdk.data.set("k", 1)).rejects.toThrow("PERMISSION_DENIED");
  await expect(m.sdk.fetch("https://example.com/x")).rejects.toThrow("PERMISSION_DENIED");
  expect(m.used).toEqual(["read:ticket", "data", "net:https://example.com/x"]);
  expect(m.violations).toEqual(["data", "net https://example.com/x"]);
});

test("data, programmed fetch and actions work in memory", async () => {
  const m = createMockSdk(
    { ...base, reads: ["ticket"], writes: [], data: true, net: ["api.github.com"] },
    {
      fetch: (url) => ({ status: 200, headers: {}, body: url }),
      server: defineServer({ actions: { count: async (ctx) => (await ctx.list("ticket")).length } }),
      seed: (run) => run({ method: "createTicket", title: "A" }),
    },
  );
  await m.sdk.data.set("k", { a: 1 });
  expect(await m.sdk.data.get<{ a: number }>("k")).toEqual({ a: 1 });
  expect(await m.sdk.data.keys()).toEqual(["k"]);
  expect((await m.sdk.fetch("https://api.github.com/x")).body).toBe("https://api.github.com/x");
  expect(await m.sdk.action<number>("count")).toBe(1);
  await expect(m.sdk.action("nope")).rejects.toThrow("PERMISSION_DENIED");
});

test("notes live in an in-memory folder with conflict detection", async () => {
  const m = createMockSdk(
    { ...base, reads: ["note", "ticket"], writes: ["note"] },
    { notes: { "a.md": "# A\n\nVoir [[b]] et KIB-1.", "b.md": "# B" } },
  );
  const list = await m.sdk.list("note");
  expect(list.map((n) => [n.path, n.title, n.links, n.tickets])).toEqual([
    ["a.md", "A", ["b.md"], ["KIB-1"]],
    ["b.md", "B", [], []],
  ]);
  const a = await m.sdk.notes.read("a.md");
  m.touchNote("a.md", "# A modifiée");
  await expect(m.sdk.notes.write("a.md", "# A2", a.mtime)).rejects.toThrow("CONFLICT");
  await m.sdk.notes.write("a.md", "# A2", null);
  expect((await m.sdk.notes.search("a2")).map((n) => n.path)).toEqual(["a.md"]);
  expect((await m.sdk.notes.info()).displayDir).toBe("~/goinfre/Kibo/notes");
});

test("notes.create refuses an existing path and is used as write:note", async () => {
  const m = createMockSdk({ ...base, reads: ["note"], writes: ["note"] }, { notes: { "a.md": "# A" } });
  await expect(m.sdk.notes.create("a.md", "# Autre")).rejects.toThrow("CONFLICT");
  expect(m.notes.get("a.md")?.markdown).toBe("# A");
  const created = await m.sdk.notes.create("b.md", "# B");
  expect([created.path, created.title]).toEqual(["b.md", "B"]);
  expect(m.used).toEqual(["write:note"]);
});

test("pasted images are attached and read back in memory, with the daemon's rules", async () => {
  const m = createMockSdk({ ...base, reads: ["note"], writes: ["note"] }, { notes: { "a.md": "# A" } });
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  expect(await m.sdk.notes.attach("a.md", "a-20261004-101500.png", "image/png", png)).toEqual({
    path: "assets/a-20261004-101500.png",
  });
  expect(await m.sdk.notes.attach("a.md", "a-20261004-101500.png", "image/png", png)).toEqual({
    path: "assets/a-20261004-101500-2.png",
  });
  const back = await m.sdk.notes.asset("assets/a-20261004-101500.png");
  expect(back.mime).toBe("image/png");
  expect([...back.bytes]).toEqual([...png]);
  await expect(m.sdk.notes.asset("assets/none.png")).rejects.toThrow("NOT_FOUND");
  await expect(m.sdk.notes.asset("assets/../a.md")).rejects.toThrow("INVALID_INPUT");
  const html = new TextEncoder().encode("<html>");
  await expect(m.sdk.notes.attach("a.md", "x.png", "image/png", html)).rejects.toThrow("INVALID_INPUT");
  await expect(m.sdk.notes.attach("a.md", "../x.png", "image/png", png)).rejects.toThrow("INVALID_INPUT");
  const big = new Uint8Array(2 * 1024 * 1024 + 1);
  big.set(png);
  await expect(m.sdk.notes.attach("a.md", "x.png", "image/png", big)).rejects.toThrow("TOO_LARGE");
  expect(m.used).toEqual(["write:note", "read:note"]);
});

test("notes.attach needs write:note", async () => {
  const m = createMockSdk({ ...base, reads: ["note"], writes: [] }, { notes: { "a.md": "# A" } });
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await expect(m.sdk.notes.attach("a.md", "x.png", "image/png", png)).rejects.toThrow("PERMISSION_DENIED");
  expect(m.violations).toEqual(["write note"]);
});

test("runs are served by list in both modes and notify run subscribers", async () => {
  const m = createMockSdk({ ...base, reads: ["ticket", "run"], writes: [] });
  const heard: string[] = [];
  const off = m.sdk.subscribe(() => heard.push("run"), "run");
  m.setRuns([{ ticketId: "1@1", runId: "r1", label: "opus-dev-1", state: "running", position: null }]);
  off();
  expect((await m.sdk.list("run")).map((r) => r.runId)).toEqual(["r1"]);
  expect(heard).toEqual(["run"]);
  expect(m.used).toEqual(["read:run"]);
});

test("the mock exposes the format, defaulting to the manifest's default format", async () => {
  const m = createMockSdk(
    { ...base, kind: "both", formats: ["small", "full"], reads: ["ticket"], writes: [] },
    { seed: (run) => run({ method: "createTicket", title: "A" }) },
  );
  expect(m.sdk.format).toBe("small");
  expect(createMockSdk({ ...base, reads: [], writes: [] }).sdk.format).toBe("medium");
  expect(createMockSdk({ ...base, reads: [], writes: [] }, { format: "half" }).sdk.format).toBe("half");
  const listed = await m.backend.call({ kind: "list", entity: "ticket" });
  expect(Array.isArray(listed) && listed.length).toBe(1);
});

const robot = { name: "robot.glb", mime: "model/gltf-binary", kind: "model", size: 600, mtime: 1 } as const;
const decode = (url: string) =>
  Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) => c.charCodeAt(0));

test("capabilities are recorded in used, undeclared ones also in violations", () => {
  const m = createMockSdk({ ...base, reads: [], writes: [], capabilities: ["webgl"] });
  m.sdk.capability("webgl");
  expect(() => m.sdk.capability("gamepad")).toThrow("PERMISSION_DENIED");
  expect(m.used).toEqual(["cap:webgl", "cap:gamepad"]);
  expect(m.violations).toEqual(["cap:gamepad"]);
});

test("project files are served as data urls under cap:assets", async () => {
  const m = createMockSdk(
    { ...base, reads: [], writes: [], capabilities: ["assets"] },
    {
      assets: [
        robot,
        { name: "logo.png", mime: "image/png", kind: "image", size: 10, mtime: 1 },
        { name: "bip.wav", mime: "audio/wav", kind: "audio", size: 10, mtime: 1 },
      ],
    },
  );
  expect((await m.sdk.assets.list()).map((a) => a.name)).toEqual(["robot.glb", "logo.png", "bip.wav"]);
  const model = await m.sdk.assets.url("robot.glb");
  expect(model.url.startsWith("data:model/gltf-binary;base64,")).toBe(true);
  expect(new TextDecoder().decode(decode(model.url).slice(0, 4))).toBe("glTF");
  const image = decode((await m.sdk.assets.url("logo.png")).url);
  expect([...image.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
  const sound = decode((await m.sdk.assets.url("bip.wav")).url);
  expect(new TextDecoder().decode(sound.slice(8, 12))).toBe("WAVE");
  await expect(m.sdk.assets.url("absent.glb")).rejects.toThrow("NOT_FOUND");
  expect(m.used).toEqual(["cap:assets"]);
});

test("project files without cap:assets are a violation", async () => {
  const m = createMockSdk({ ...base, reads: [], writes: [] }, { assets: [robot] });
  await expect(m.sdk.assets.list()).rejects.toThrow("PERMISSION_DENIED");
  expect(m.violations).toEqual(["cap:assets"]);
});

const FIGMA_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";

test("design frames are served as data urls under cap:design", async () => {
  const frames = [{ url: FIGMA_URL, name: "Tickets" }];
  const m = createMockSdk({ ...base, reads: [], writes: [], capabilities: ["design"] }, { frames });
  const frame = await m.sdk.design.frame(FIGMA_URL);
  expect(frame).toMatchObject({ provider: "figma", name: "Tickets", stale: false });
  expect(frame.url.startsWith("data:image/png;base64,")).toBe(true);
  expect(m.used).toEqual(["cap:design"]);
  expect(m.violations).toEqual([]);
});

test("design frames without cap:design are a violation", async () => {
  const m = createMockSdk({ ...base, reads: [], writes: [] }, { frames: [{ url: FIGMA_URL, name: "T" }] });
  await expect(m.sdk.design.frame(FIGMA_URL)).rejects.toThrow("PERMISSION_DENIED");
  expect(m.violations).toEqual(["cap:design"]);
});

test("the mock drives focus, visibility and selection and records requests", () => {
  const m = createMockSdk(
    { ...base, reads: [], writes: [], selection: true },
    { visible: false, focus: true },
  );
  expect(m.sdk.visibility.visible()).toBe(false);
  expect(m.sdk.focus.active()).toBe(true);
  let hits = 0;
  m.sdk.visibility.subscribe(() => hits++);
  m.setVisible(true);
  m.setFocus(false);
  expect(m.sdk.visibility.visible()).toBe(true);
  expect(m.sdk.focus.active()).toBe(false);
  expect(hits).toBe(1);
  m.sdk.focus.request();
  m.sdk.focus.exit();
  expect(m.focusRequests).toEqual([true, false]);
  m.setSelection({ kind: "ticket", ids: ["a"] });
  expect(m.sdk.selection.get()).toEqual({ kind: "ticket", ids: ["a"] });
  m.sdk.selection.set(null);
  expect(m.selections).toEqual([null]);
  expect(m.sdk.selection.get()).toBeNull();
});
