import { expect, test } from "bun:test";
import { join } from "node:path";
import type { RunMoment, RunMomentsPage, RunPeek, RunView } from "@kibo/schema";
import { scenarioPath } from "../agents/fake-claude-scenario";
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
