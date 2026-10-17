import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GithubPrRef, PrInfo, ProjectMeta, RpcRequest, Ticket } from "@kibo/schema";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { attachPr, type Candidate } from "./pr-discovery";
import { type PrPoller, startPrPoller } from "./pr-poller";
import { installFakeGh } from "./testing/git-fixture";

let dir: string;
let store: Store;
let service: Service;
let project: ProjectMeta;
let poller: PrPoller | null;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kibo-discovery-"));
  store = openStore(join(dir, "home"));
  service = createService(store, { user: "adam" });
  project = call(service, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: dir,
    color: "#F97316",
  });
  poller = null;
});
afterEach(() => {
  poller?.stop();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const URL = "https://github.com/kibo/test/pull/20";
const INFO: PrInfo = {
  number: 20,
  url: URL,
  state: "open",
  base: "main",
  head: "feat/x",
  review: "none",
  checks: "running",
};

const command = (cmd: Extract<RpcRequest, { method: "command" }>["command"]) =>
  call(service, { method: "command", projectId: project.id, command: cmd });

function reviewed(ref: GithubPrRef): string {
  const ticket = command({ method: "createTicket", title: "Envoi" }) as Ticket;
  command({ method: "setStatus", ticketId: ticket.id, statusId: "in_review" });
  command({ method: "upsertExternalRef", ticketId: ticket.id, ref });
  return ticket.id;
}

const prOf = (ticketId: string) =>
  call(service, { method: "getProject", projectId: project.id })
    .tickets.find((t) => t.id === ticketId)
    ?.externalRefs.find((r): r is GithubPrRef => r.kind === "github_pr");

const candidate = (ticketId: string): Candidate => ({
  projectId: project.id,
  folder: dir,
  ticketId,
  branch: "feat/x",
  known: [prOf(ticketId)].filter((r): r is GithubPrRef => r !== undefined),
});

function watchCommands() {
  const methods: string[] = [];
  const off = service.commands.onCommand((e) => methods.push(e.command.method));
  const rules = spyOn(service, "triggerRules");
  return { methods, rules, off };
}

test("a review that alone changes rewrites the PR without running any rule", () => {
  const id = reviewed({ kind: "github_pr", ...INFO });
  const watch = watchCommands();
  attachPr(service, candidate(id), { ...INFO, review: "changes_requested" });
  expect(watch.methods).toEqual(["upsertExternalRef"]);
  expect(watch.rules).not.toHaveBeenCalled();
  expect(prOf(id)).toMatchObject({ review: "changes_requested", checks: "running" });
  watch.off();
});

test("checks that pass from running to ok rewrite the PR once, an identical PR writes nothing", () => {
  const id = reviewed({ kind: "github_pr", ...INFO });
  const watch = watchCommands();
  attachPr(service, candidate(id), { ...INFO, checks: "ok" });
  attachPr(service, candidate(id), { ...INFO, checks: "ok" });
  expect(watch.methods).toEqual(["upsertExternalRef"]);
  expect(watch.rules).not.toHaveBeenCalled();
  expect(prOf(id)?.checks).toBe("ok");
  watch.off();
});

test("the poller follows the review and the checks of an open PR, the status stays in review", async () => {
  const gh = installFakeGh(dir);
  const id = reviewed({ kind: "github_pr", ...INFO });
  writeFileSync(
    gh.FAKE_GH_STATE ?? "",
    JSON.stringify([
      {
        number: 20,
        url: URL,
        state: "OPEN",
        isDraft: false,
        head: "feat/x",
        base: "main",
        reviewDecision: "CHANGES_REQUESTED",
        statusCheckRollup: [{ status: "COMPLETED", conclusion: "FAILURE" }],
      },
    ]),
  );
  poller = startPrPoller(service, gh, 60_000, () => () => undefined);
  await poller.tick();
  expect(prOf(id)).toMatchObject({ state: "open", review: "changes_requested", checks: "error" });
  const ticket = call(service, { method: "getProject", projectId: project.id }).tickets.find(
    (t) => t.id === id,
  );
  expect(ticket?.statusId).toBe("in_review");
});
