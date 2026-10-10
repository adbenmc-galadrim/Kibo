import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ChangeMessage, Ticket } from "@kibo/schema";
import { fakeAgentsPort } from "./agents-port.test-helper";
import { runView } from "./questions/questions.test-helper";
import { call, createService } from "./service";
import { openStore } from "./store";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "kibo-service-activity-"));
  dirs.push(dir);
  const s = createService(openStore(dir), { user: "adam" });
  const project = call(s, {
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  });
  const ticket = Ticket.parse(
    call(s, {
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title: "Stockage", statusId: "todo" },
    }),
  );
  const startable = () =>
    call(s, { method: "getProject", projectId: project.id }).tickets.find((t) => t.id === ticket.id)
      ?.startable;
  const messages: ChangeMessage[] = [];
  s.onChange((m) => messages.push(m));
  return { s, project, ticket, startable, messages };
}

test("a ticket is startable without agents and not while a run is queued, running or waiting", () => {
  for (const state of ["queued", "running", "waiting_input"] as const) {
    const { s, project, ticket, startable } = setup();
    expect(startable()).toBe(true);
    const off = s.attachAgents(
      fakeAgentsPort([runView({ id: "r1", projectId: project.id, ticketId: ticket.id, state })]),
    );
    expect(startable()).toBe(false);
    off();
    expect(startable()).toBe(true);
  }
});

test("a finished run frees the ticket and the project is announced as changed", () => {
  const { s, project, ticket, startable, messages } = setup();
  const run = runView({ id: "r1", projectId: project.id, ticketId: ticket.id, state: "running" });
  const port = fakeAgentsPort([run]);
  s.attachAgents(port);
  expect(startable()).toBe(false);
  port.change({ ...run, state: "done" });
  expect(startable()).toBe(true);
  expect(messages).toContainEqual({ projectId: project.id });
  port.change({ ...run, id: "r2", state: "queued" });
  expect(startable()).toBe(false);
});

test("a run without a project changes nothing and announces nothing", () => {
  const { s, startable, messages } = setup();
  const port = fakeAgentsPort([]);
  s.attachAgents(port);
  port.change(runView({ id: "r1", projectId: null, ticketId: null, kind: "project", state: "running" }));
  expect(startable()).toBe(true);
  expect(messages.filter((m) => "projectId" in m)).toEqual([]);
});
