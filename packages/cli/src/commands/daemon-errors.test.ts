import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../index";
import { fakeSnapshot, SILO_META } from "./tickets-test-kit";

type Answer = { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } };
type Rpc = (method: string) => Answer | Response | null;

const APP_INFO = {
  version: "0.23.0-alpha.3",
  platform: "darwin",
  arch: "arm64",
  home: "~/.kibo",
  userHome: null,
  daemonPid: 1,
  uptimeMs: 1,
  fixedNow: null,
};
const ok = (result: unknown): Answer => ({ ok: true, result });
const refused = (code: string, message: string): Answer => ({ ok: false, error: { code, message } });

const cleanups: (() => void)[] = [];
afterAll(() => {
  for (const c of cleanups) c();
});

function fakeOldDaemon(answer: Rpc) {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      if (new URL(req.url).pathname === "/api/pair")
        return new Response(null, { status: 204, headers: { "set-cookie": "s=1" } });
      const { method } = (await req.json()) as { method: string };
      if (method === "listSessions") return Response.json(ok([]));
      if (method === "listProjects") return Response.json(ok([{ ...SILO_META, counts: {} }]));
      if (method === "getProject") return Response.json(ok(fakeSnapshot()));
      const given = answer(method) ?? refused("INVALID_INPUT", "invalid request: method");
      return given instanceof Response ? given : Response.json(given);
    },
  });
  const home = mkdtempSync(join(tmpdir(), "kibo-cli-old-"));
  writeFileSync(join(home, "daemon.json"), JSON.stringify({ port: server.port, sandboxPort: 1, pid: 1 }));
  writeFileSync(join(home, "token"), "t");
  cleanups.push(() => {
    server.stop(true);
    rmSync(home, { recursive: true, force: true });
  });
  const err: string[] = [];
  const io = { home, out: () => {}, err: (l: string) => err.push(l) };
  return { err, run: (...argv: string[]) => runCli(argv, io) };
}

test("an unknown method names the daemon, its version and the command to update for", async () => {
  const d = fakeOldDaemon((m) => (m === "getAppInfo" ? ok(APP_INFO) : null));
  expect(await d.run("tickets", "set", "SILO-33", "branch=feat/x")).toBe(1);
  expect(d.err).toEqual([
    "Le démon ~/.kibo (0.23.0-alpha.3) est trop ancien pour kibo tickets set : mets Kibo à jour, puis réessaie.",
  ]);
});

test("any other refusal keeps its code and names the daemon", async () => {
  const d = fakeOldDaemon((m) => {
    if (m === "getAppInfo") return ok({ ...APP_INFO, version: "0.27.0-alpha.1" });
    if (m === "declareTicketRef") return refused("NOT_FOUND", "ticket SILO-33");
    return null;
  });
  expect(await d.run("tickets", "set", "SILO-33", "branch=feat/x")).toBe(1);
  expect(d.err).toEqual(["Erreur NOT_FOUND : ticket SILO-33 (démon ~/.kibo, 0.27.0-alpha.1)"]);
});

test("falls back on the home it reached when the daemon cannot tell its version", async () => {
  const d = fakeOldDaemon(() => null);
  expect(await d.run("tickets", "set", "SILO-33", "status=wip")).toBe(1);
  expect(d.err.at(-1)).toMatch(
    /^Le démon \/.+kibo-cli-old-\S+ \(version inconnue\) est trop ancien pour kibo tickets set :/,
  );
});

test("keeps the original error when getAppInfo answers garbage", async () => {
  const d = fakeOldDaemon((m) => {
    if (m === "getAppInfo") return new Response("<html>", { headers: { "content-type": "text/html" } });
    if (m === "declareTicketRef") return refused("NOT_FOUND", "ticket SILO-33");
    return null;
  });
  expect(await d.run("tickets", "set", "SILO-33", "branch=feat/x")).toBe(1);
  expect(d.err.at(-1)).toMatch(
    /^Erreur NOT_FOUND : ticket SILO-33 \(démon \/\S+kibo-cli-old-\S+, version inconnue\)$/,
  );
});

test("a known refusal is explained in French", async () => {
  const d = fakeOldDaemon((m) => {
    if (m === "getAppInfo") return ok(APP_INFO);
    if (m === "command") return refused("INVALID_INPUT", "a hold needs a step (a feature cannot be held)");
    return null;
  });
  expect(await d.run("tickets", "set", "SILO-30", "hold=attente client")).toBe(1);
  expect(d.err).toEqual(["Une attente se pose sur une étape, pas sur une fonctionnalité."]);
});

test("an old daemon without applyPlan is explained for kibo plan apply", async () => {
  const d = fakeOldDaemon((m) => (m === "getAppInfo" ? ok(APP_INFO) : null));
  const folder = mkdtempSync(join(tmpdir(), "kibo-cli-plan-"));
  cleanups.push(() => rmSync(folder, { recursive: true, force: true }));
  const plan = join(folder, "plan.yaml");
  writeFileSync(plan, "actions:\n  - type: addRecipient\n    name: dsi\n");
  expect(await d.run("plan", "apply", plan, "--project", "SILO")).toBe(1);
  expect(d.err).toEqual([
    "Le démon ~/.kibo (0.23.0-alpha.3) est trop ancien pour kibo plan apply : mets Kibo à jour, puis réessaie.",
  ]);
});
