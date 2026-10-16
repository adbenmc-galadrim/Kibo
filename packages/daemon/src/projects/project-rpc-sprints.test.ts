import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectCommand, ProjectMeta, ProjectSnapshot, Sprint, Ticket } from "@kibo/schema";
import { createClock } from "../clock";
import { createService } from "../service";
import { openStore } from "../store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function seeded(fixedNow: string) {
  const dir = mkdtempSync(join(tmpdir(), "kibo-project-sprints-"));
  dirs.push(dir);
  const store = openStore(dir);
  const service = createService(store, { user: "adam", clock: createClock(fixedNow) });
  const project = service.handle({
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  }) as ProjectMeta;
  const run = (command: ProjectCommand) =>
    service.handle({ method: "command", projectId: project.id, command });
  const s43 = run({ method: "createSprint", name: "S43", start: "2026-10-19", end: "2026-10-23" }) as Sprint;
  const s42 = run({ method: "createSprint", name: "S42", start: "2026-10-12", end: "2026-10-16" }) as Sprint;
  const s41 = run({ method: "createSprint", name: "S41", start: "2026-10-05", end: "2026-10-09" }) as Sprint;
  const feature = run({ method: "createTicket", title: "Envoi hors ligne" }) as Ticket;
  const step = run({ method: "createTicket", title: "File d'envoi", parentId: feature.id }) as Ticket;
  run({ method: "setTicketSprint", ticketId: feature.id, sprintId: s42.id });
  const snapshot = () => service.handle({ method: "getProject", projectId: project.id }) as ProjectSnapshot;
  return { snapshot, ids: { s41: s41.id, s42: s42.id, s43: s43.id, feature: feature.id, step: step.id } };
}

test("getProject gives the sprints in order, dated by the daemon clock, and the feature views", () => {
  const { snapshot, ids } = seeded("2026-10-16T14:52:00+02:00");
  const snap = snapshot();
  expect(snap.sprints.map((s) => [s.id, s.state])).toEqual([
    [ids.s41, "done"],
    [ids.s42, "current"],
    [ids.s43, "planned"],
  ]);
  expect(snap.sprints[1]?.features).toEqual([ids.feature]);
  const feature = snap.tickets.find((t) => t.id === ids.feature);
  expect(feature?.feature?.status).toBe("todo");
  expect(snap.tickets.find((t) => t.id === ids.step)?.effectiveSprintId).toBe(ids.s42);
});

test("the day after the end of its sprint an unfinished feature is late", () => {
  const { snapshot, ids } = seeded("2026-10-17T09:00:00+02:00");
  const snap = snapshot();
  expect(snap.sprints.find((s) => s.id === ids.s42)?.state).toBe("done");
  expect(snap.tickets.find((t) => t.id === ids.feature)?.feature?.status).toBe("late");
});
