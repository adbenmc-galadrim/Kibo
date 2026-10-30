import { expect, test } from "bun:test";
import { type ProjectCommand, Ticket } from "@kibo/schema";
import { seedQuestions } from "./fixtures";
import { createMockSdk } from "./mock";

const base = { id: "probe", version: "0.1.0", kind: "widget" as const, title: "Probe" };

test("every attempt is recorded in used, denials also in violations", async () => {
  const m = createMockSdk({ ...base, reads: ["ticket"], writes: [] });
  await m.sdk.list("ticket");
  await expect(m.sdk.data.set("k", 1)).rejects.toThrow("PERMISSION_DENIED");
  await expect(m.sdk.fetch("https://example.com/x")).rejects.toThrow("PERMISSION_DENIED");
  expect(m.used).toEqual(["read:ticket", "data", "net:https://example.com/x"]);
  expect(m.violations).toEqual(["data", "net https://example.com/x"]);
});

test("data and programmed fetch work in memory, actions are refused", async () => {
  const m = createMockSdk(
    { ...base, reads: ["ticket"], writes: [], data: true, net: ["api.github.com"] },
    {
      fetch: (url) => ({ status: 200, headers: {}, body: url }),
      seed: (run) => run({ method: "createTicket", title: "A" }),
    },
  );
  await m.sdk.data.set("k", { a: 1 });
  expect(await m.sdk.data.get<{ a: number }>("k")).toEqual({ a: 1 });
  expect(await m.sdk.data.keys()).toEqual(["k"]);
  expect((await m.sdk.fetch("https://api.github.com/x")).body).toBe("https://api.github.com/x");
  await expect(m.sdk.action("nope")).rejects.toThrow("PERMISSION_DENIED");
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

test("questions are listed and created under their permissions, always as the viewer", async () => {
  let ticketId = "";
  const m = createMockSdk(
    { ...base, reads: ["question", "ticket"], writes: ["question"] },
    {
      viewer: "camille",
      seed: (run) => {
        ticketId = Ticket.parse(run({ method: "createTicket", title: "Stockage S3" })).id;
        seedQuestions(run, [ticketId]);
      },
    },
  );
  expect((await m.sdk.list("question")).map((q) => q.createdBy.kind)).toEqual(["agent", "agent"]);
  const created = await m.sdk.run({
    method: "createQuestion",
    ticketId,
    title: "Quel port ?",
    createdBy: { kind: "agent", ref: "silo-livraison" },
  });
  expect(created.createdBy).toEqual({ kind: "human", ref: "camille" });
  const answered = await m.sdk.run({
    method: "answerQuestion",
    questionId: created.id,
    answer: { kind: "text", text: "443" },
    by: { kind: "agent", ref: "silo-livraison" },
  });
  expect(answered.answer?.by).toEqual({ kind: "human", ref: "camille" });
  const imported = await m.sdk.run({
    method: "createQuestion",
    ticketId,
    title: "Q1",
    createdBy: { kind: "import", ref: "plan" },
  });
  expect(imported.createdBy).toEqual({ kind: "import", ref: "plan" });
  expect(m.used).toEqual(["read:question", "write:question"]);
});

test("questions need read:question to be listed and write:question to be written", async () => {
  const reader = createMockSdk({ ...base, reads: ["question"], writes: [] });
  await expect(reader.sdk.run({ method: "removeQuestion", questionId: "q1" })).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  const writer = createMockSdk({ ...base, reads: ["ticket"], writes: ["question"] });
  await expect(writer.sdk.list("question")).rejects.toThrow("PERMISSION_DENIED");
  expect([...reader.violations, ...writer.violations]).toEqual(["write removeQuestion", "read question"]);
});

test("questions offer recipients and image urls, no delivery, and marking stays reserved", async () => {
  let ticketId = "";
  const seed = (run: (cmd: ProjectCommand) => unknown) => {
    ticketId = Ticket.parse(run({ method: "createTicket", title: "Stockage S3" })).id;
    seedQuestions(run, [ticketId]);
  };
  const m = createMockSdk({ ...base, reads: ["question", "ticket"], writes: ["question"] }, { seed });
  expect(Object.keys(m.sdk.questions).sort()).toEqual(["imageUrl", "recipients"]);
  expect("deliveries" in m).toBe(false);
  expect(m.sdk.questions.imageUrl("q 1", "i/2")).toBe("/api/questions/q%201/images/i%2F2");
  const [answered] = (await m.sdk.list("question")).filter((q) => q.answer !== null);
  await expect(
    m.sdk.run({
      method: "markAnswersDelivered",
      ticketId,
      questionIds: [answered?.id ?? ""],
      runId: "r1",
      at: 1,
    }),
  ).rejects.toThrow("PERMISSION_DENIED");
});
