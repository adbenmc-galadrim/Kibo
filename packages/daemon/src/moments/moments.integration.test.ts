import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import type { RunMoment, RunMomentsPage, RunPeek, RunView } from "@kibo/schema";
import { scenarioPath } from "../runs/fake-claude-scenario";
import { cleanupTmp, repo } from "../testing/git-test-kit";
import {
  assign,
  type Client,
  cleanDaemons,
  runIn,
  seed,
  startTestDaemon,
  waitFor,
} from "./daemon-client.test-helper";

cleanDaemons();
afterEach(cleanupTmp);

const start = (transcriptRoot: (home: string) => string) =>
  startTestDaemon({ scenario: scenarioPath("done"), transcriptRoot });

async function runToEnd(c: Client): Promise<RunView> {
  const run = await assign(c, await seed(c));
  return runIn(c, run.id, ["done"]);
}

const momentsOf = (rpc: Client["rpc"], runId: string) => rpc<RunMomentsPage>({ method: "runMoments", runId });

test("the daemon serves the narrative of a fake claude run and broadcasts it", async () => {
  const c = await start((home) => join(home, "fake"));
  const run = await runToEnd(c);
  const page = await waitFor(async () => {
    const p = await momentsOf(c.rpc, run.id);
    return p.moments.some((m) => m.data.kind === "message") ? p : undefined;
  });
  expect(page.source).toBe("transcript");
  expect(page.moments.map((m) => m.data)).toEqual([
    expect.objectContaining({ kind: "actions", summary: "A lu 1 fichier" }),
    { kind: "message", text: "Travail terminé." },
    { kind: "reminder", reminder: "report" },
  ]);
  const broadcast = c.events.flatMap((e) =>
    typeof e === "object" && e !== null && Reflect.get(e, "type") === "run.moments"
      ? (Reflect.get(e, "moments") as RunMoment[])
      : [],
  );
  expect(broadcast.map((m) => m.seq)).toEqual(page.moments.map((m) => m.seq));
  expect((await momentsOf(c.rpc, run.id)).moments).toEqual(page.moments);
  const peek = await c.rpc<RunPeek>({ method: "runPeek", runId: run.id });
  expect(peek).toMatchObject({
    runId: run.id,
    state: "done",
    lastMessage: "Travail terminé.",
    waiting: false,
  });
}, 40_000);

test("a resumed run shows only what follows its resumption", async () => {
  const c = await start((home) => join(home, "fake"));
  const seeded = await seed(c, { folder: await repo(), workspace: "repo" });
  const first = await runIn(c, (await assign(c, seeded)).id, ["done"]);
  const narrated = (runId: string) =>
    waitFor(async () => {
      const p = await momentsOf(c.rpc, runId);
      return p.moments.some((m) => m.data.kind === "reminder") ? p : undefined;
    });
  const before = await narrated(first.id);
  const resumed = await runIn(c, (await assign(c, seeded)).id, ["done"]);
  expect(resumed.session).toEqual({ mode: "resumed", from: first.id });
  expect(resumed.sessionId).toBe(first.sessionId);
  const after = await narrated(resumed.id);
  const gist = (page: RunMomentsPage) =>
    page.moments.map(({ data }) =>
      data.kind === "actions" ? data.summary : data.kind === "message" ? data.text : data.kind,
    );
  expect(gist(before)).toEqual(["A lu 1 fichier", "Travail terminé.", "reminder"]);
  expect(gist(after)).toEqual(gist(before));
}, 60_000);

test("a transcript outside the accepted root falls back on the hooks", async () => {
  const c = await start((home) => join(home, "ailleurs"));
  const run = await runToEnd(c);
  const page = await waitFor(async () => {
    const p = await momentsOf(c.rpc, run.id);
    return p.moments.some((m) => m.data.kind === "message") ? p : undefined;
  });
  expect(page).toMatchObject({ source: "hooks", partial: "path-rejected" });
  expect(page.moments.map((m) => m.data.kind)).toEqual(["raw", "actions", "reminder", "message", "message"]);
  await expect(c.rpc({ method: "runMoments", runId: "inconnu" })).rejects.toThrow("NOT_FOUND");
}, 40_000);
