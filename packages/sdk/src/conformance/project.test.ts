import { expect, test } from "bun:test";
import { Ticket } from "@kibo/schema";
import { createMockSdk } from "../mock";

const manifest = (reads: ("ticket" | "sprint")[]) => ({
  id: "overview",
  version: "1.0.0",
  kind: "view" as const,
  title: "Vue d'ensemble",
  reads,
  writes: [],
});
const PR = {
  kind: "github_pr" as const,
  url: "https://github.com/silo-labs/silo-location/pull/22",
  number: 22,
  state: "open" as const,
  base: "dev",
  head: null,
  review: "none" as const,
  checks: null,
};

test("the project describes itself and names its repository", async () => {
  const mock = createMockSdk(manifest(["ticket"]), {
    description: "Location de box",
    today: "2026-10-16",
    seed: (run) => {
      const { id } = Ticket.parse(run({ method: "createTicket", title: "Envoi" }));
      run({ method: "upsertExternalRef", ticketId: id, ref: PR });
    },
  });
  expect(await mock.sdk.project.get()).toEqual({
    id: "mock",
    key: "KIB",
    name: "Mock",
    color: "#71717A",
    description: "Location de box",
    client: null,
    hasFolder: false,
    repo: "silo-labs/silo-location",
    today: "2026-10-16",
  });
  expect(mock.used).toContain("read:ticket");
  expect(mock.violations).toEqual([]);
});

test("the mock project tells whether a repository folder is set", async () => {
  const mock = createMockSdk(manifest(["ticket"]), { folder: "/tmp/silo" });
  expect((await mock.sdk.project.get()).hasFolder).toBe(true);
});

test("the mock records the project edits asked by the component", () => {
  const mock = createMockSdk(manifest(["ticket"]));
  mock.sdk.project.edit({ field: "folder" });
  expect(mock.projectEdits).toEqual([{ field: "folder" }]);
});

test("reading the project needs read:ticket", async () => {
  const mock = createMockSdk(manifest(["sprint"]));
  await expect(mock.sdk.project.get()).rejects.toThrow("PERMISSION_DENIED");
  expect(mock.violations).toEqual(["read project"]);
});

test("the project is followed through its changes", async () => {
  const mock = createMockSdk(manifest(["ticket"]));
  let calls = 0;
  const off = mock.sdk.project.subscribe(() => {
    calls += 1;
  });
  mock.run({ method: "createTicket", title: "Nouveau" });
  off();
  mock.run({ method: "createTicket", title: "Ignoré" });
  expect(calls).toBe(1);
});

test("opening a sprint is a host action recorded by the mock", () => {
  const mock = createMockSdk(manifest(["sprint"]));
  mock.sdk.sprints.open("s42");
  expect(mock.openedSprints).toEqual(["s42"]);
});

test("the project names its client when it has one", async () => {
  const mock = createMockSdk(manifest(["ticket"]), { client: "Silo SA" });
  expect((await mock.sdk.project.get()).client).toBe("Silo SA");
});

test("a toast is a host action recorded by the mock", () => {
  const mock = createMockSdk(manifest([]));
  mock.sdk.toast("Copié");
  expect(mock.toasts).toEqual(["Copié"]);
});
