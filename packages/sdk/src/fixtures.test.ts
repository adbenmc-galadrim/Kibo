import { expect, test } from "bun:test";
import { DEMO_NOTE_AGES, DEMO_NOTES, seedDemo } from "./fixtures";
import { createMockSdk } from "./mock";

test("the demo data matches design/donnees-fictives.md", async () => {
  let ids: Record<string, string> = {};
  const m = createMockSdk(
    {
      id: "probe",
      version: "0.1.0",
      kind: "view",
      title: "Probe",
      reads: ["ticket", "link", "note"],
      writes: [],
    },
    {
      seed: (run) => {
        ids = seedDemo(run);
      },
      notes: DEMO_NOTES,
      noteAges: DEMO_NOTE_AGES,
    },
  );
  const tickets = await m.sdk.list("ticket");
  const byKey = Object.fromEntries(tickets.map((t) => [t.keyLabel, t]));
  expect(tickets).toHaveLength(22);
  expect(Object.keys(ids).sort()).toEqual(tickets.map((t) => t.keyLabel).sort());
  expect(ids["KIB-12"]).toBe(byKey["KIB-12"]?.id);
  expect(byKey["KIB-21"]?.statusId).toBe("blocked");
  expect(byKey["KIB-21"]?.blockedReason).toBe("Audit sécurité externe en attente");
  expect(byKey["KIB-12"]?.assignee).toEqual({ kind: "agent", ref: "opus-dev-1" });
  expect(byKey["KIB-15"]?.waitingOn).toEqual(["KIB-12"]);
  expect((await m.sdk.list("link")).filter((l) => l.type === "blocks")).toHaveLength(6);
  const notes = await m.sdk.list("note");
  expect(notes.map((n) => n.path)).toEqual([
    "decisions-architecture.md",
    "journal-agents.md",
    "idees-composants.md",
    "reunion-kick-off.md",
  ]);
  const decisions = notes.find((n) => n.title === "Décisions d'architecture");
  expect(decisions?.tickets).toEqual(["KIB-12", "KIB-13", "KIB-14"]);
  expect(notes.filter((n) => n.links.includes(decisions?.path ?? "")).map((n) => n.links.length)).toEqual([
    1, 2,
  ]);
});

test("the demo data seeds a shared project whose keys are still provisional", async () => {
  const m = createMockSdk(
    { id: "probe", version: "0.1.0", kind: "view", title: "Probe", reads: ["ticket", "link"], writes: [] },
    { shared: true, seed: (run) => void seedDemo(run) },
  );
  const tickets = await m.sdk.list("ticket");
  expect(tickets).toHaveLength(22);
  expect(tickets.every((t) => t.key === null)).toBe(true);
  expect((await m.sdk.list("link")).filter((l) => l.type === "blocks")).toHaveLength(6);
});
