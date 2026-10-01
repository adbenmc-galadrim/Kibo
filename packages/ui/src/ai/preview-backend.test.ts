import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { burndownManifest as manifest } from "./draft-fixtures";
import { inMemoryWorkers } from "./preview-channel";
import { createWorkerBackend, relayedCode } from "./worker-backend";

test("the worker is spawned on the first call and answers with the demo project", async () => {
  const c = inMemoryWorkers();
  const backend = createWorkerBackend(manifest, c.spawn);
  expect(c.spawned()).toBe(0);
  const tickets = await backend.call({ kind: "list", entity: "ticket" });
  expect(c.spawned()).toBe(1);
  expect(Array.isArray(tickets) && tickets.length > 0).toBe(true);
  expect(c.sentToWorker[0]).toMatchObject({ type: "init", manifest: { id: "burndown" } });
  backend.dispose();
  expect(c.terminated()).toBe(1);
});

test("a command changes only the demo project and notifies the host", async () => {
  const c = inMemoryWorkers();
  const backend = createWorkerBackend(manifest, c.spawn);
  let changes = 0;
  backend.subscribe(() => changes++);
  const before = await backend.call({ kind: "list", entity: "ticket" });
  await backend.call({ kind: "run", command: { method: "createTicket", title: "Essai d'aperçu" } });
  const after = await backend.call({ kind: "list", entity: "ticket" });
  expect(Array.isArray(before) && Array.isArray(after) && after.length === before.length + 1).toBe(true);
  await new Promise((r) => setTimeout(r, 0));
  expect(changes).toBeGreaterThan(0);
  backend.dispose();
});

test("a refusal of the mock comes back as a KiboError", async () => {
  const c = inMemoryWorkers();
  const backend = createWorkerBackend(manifest, c.spawn);
  const refused = await backend.call({ kind: "notes.read", path: "absent.md" }).then(
    () => null,
    (e: unknown) => e,
  );
  expect(refused).toBeInstanceOf(KiboError);
  backend.dispose();
});

test("invalid requests and replies are ignored; calls after dispose are refused", async () => {
  const c = inMemoryWorkers();
  const backend = createWorkerBackend(manifest, c.spawn);
  await backend.call({ kind: "data.keys" });
  const warn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  c.toWorker({ type: "call", id: -1, call: { kind: "nope" } });
  await new Promise((r) => setTimeout(r, 0));
  console.warn = warn;
  expect(warnings).toHaveLength(1);
  backend.dispose();
  expect(
    await backend.call({ kind: "data.keys" }).then(
      () => "answered",
      (e: unknown) => (e instanceof KiboError ? e.code : "other"),
    ),
  ).toBe("INVALID_INPUT");
});

test("the bundled worker answers from its own thread", async () => {
  const backend = createWorkerBackend(manifest);
  const tickets = await backend.call({ kind: "list", entity: "ticket" });
  expect(Array.isArray(tickets) && tickets.length > 0).toBe(true);
  backend.dispose();
});

test("a crashed worker fails the pending calls, then every call, and tells the host", async () => {
  const c = inMemoryWorkers();
  const backend = createWorkerBackend(manifest, c.spawn);
  let failures = 0;
  backend.onFailure(() => failures++);
  const errors = console.error;
  console.error = () => {};
  const pending = backend.call({ kind: "data.keys" }).then(
    () => "answered",
    (e: unknown) => (e instanceof KiboError ? e.code : "other"),
  );
  c.crash();
  console.error = errors;
  expect(await pending).toBe("INTERNAL");
  expect(failures).toBe(1);
  expect(
    await backend.call({ kind: "data.keys" }).then(
      () => "answered",
      (e: unknown) => (e instanceof KiboError ? e.code : "other"),
    ),
  ).toBe("INTERNAL");
  backend.dispose();
});

test("only the codes the demo project raises are relayed; anything else reads as INTERNAL", () => {
  expect(relayedCode("NOT_FOUND")).toBe("NOT_FOUND");
  expect(relayedCode("FILE_CHANGED")).toBe("FILE_CHANGED");
  expect(relayedCode("UNAUTHORIZED")).toBe("INTERNAL");
  expect(relayedCode("whatever")).toBe("INTERNAL");
});
