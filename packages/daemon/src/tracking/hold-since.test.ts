import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import type { CommandMeta } from "../docs";
import { holdSinceInterceptor } from "./hold-since";

const intercept = holdSinceInterceptor(() => "2026-10-16");
const meta = (origin: CommandMeta["origin"]): CommandMeta => ({ origin, instanceId: null });
const hold: ProjectCommand = { method: "setHold", ticketId: "t1", reason: "Serveur de recette indisponible" };

test("a hold takes the day of the daemon, whatever its origin", () => {
  for (const origin of ["user", "agent", "kibo"] as const)
    expect(intercept("p1", hold, meta(origin))).toEqual({ ...hold, since: "2026-10-16" });
});

test("the day sent by a client is replaced by the day of the daemon", () => {
  expect(intercept("p1", { ...hold, since: "2020-01-01" }, meta("user"))).toEqual({
    ...hold,
    since: "2026-10-16",
  });
});

test("a resume and any other command pass unchanged", () => {
  const resume: ProjectCommand = { method: "setHold", ticketId: "t1", reason: null };
  expect(intercept("p1", resume, meta("user"))).toBe(resume);
  const other: ProjectCommand = { method: "setStatus", ticketId: "t1", statusId: "done" };
  expect(intercept("p1", other, meta("user"))).toBe(other);
});
