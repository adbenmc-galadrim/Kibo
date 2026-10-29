import { afterEach, expect, test } from "bun:test";
import type { MomentData } from "@kibo/schema";
import {
  assign,
  autoLinksOf,
  type Boutique,
  finished,
  momentsOf,
  release,
  startBoutique,
  until,
  wrote,
} from "./overlaps/integration.test-helper";
import { snapshotOf, stopDaemons } from "./project-agent/integration.test-helper";
import { cleanupTmp } from "./testing/git-test-kit";

afterEach(async () => {
  await stopDaemons();
  cleanupTmp();
});

type AutoLinkMoment = Extract<MomentData, { kind: "auto_link" }>;

async function autoLinkMoment(b: Boutique, runId: string): Promise<AutoLinkMoment> {
  return until(async () => {
    const found = (await momentsOf(b.stack.rpc, runId)).find((m) => m.data.kind === "auto_link");
    return found?.data.kind === "auto_link" ? found.data : undefined;
  });
}

async function startOwner(b: Boutique) {
  const owner = await assign(b, "BOU-12");
  await wrote(b.stack, owner, 2);
  return owner;
}

test("an import of a module only the owner added links the two tickets without any copy", async () => {
  const b = await startBoutique();
  const owner = await startOwner(b);
  const reader = await assign(b, "BOU-18");
  await finished(b.stack.rpc, reader.id);
  const link = await until(async () =>
    (await autoLinksOf(b.stack.rpc, b.project.id)).find((l) => l.status === "added"),
  );
  expect(link).toMatchObject({
    reason: "import",
    fromTicketKey: "BOU-12",
    toTicketKey: "BOU-18",
    detail: { path: "src/lib/format.ts" },
  });
  for (const run of [owner, reader])
    expect(await autoLinkMoment(b, run.id)).toMatchObject({ autoLinkId: link.id, failure: null });
  const snapshot = await snapshotOf(b.stack.rpc, b.project.id);
  expect(snapshot.links.find((l) => l.id === link.linkId)).toMatchObject({ type: "blocks" });
  release(b.stack, owner);
  await finished(b.stack.rpc, owner.id);
}, 90_000);

test("a link that would close a cycle is never added and both feeds say why", async () => {
  const b = await startBoutique();
  const owner = await startOwner(b);
  const [from, to] = [b.tickets.get("BOU-18")?.id, b.tickets.get("BOU-12")?.id];
  await b.stack.rpc({
    method: "command",
    projectId: b.project.id,
    command: { method: "addLink", from, to, type: "blocks" },
  });
  const reader = await assign(b, "BOU-18");
  await finished(b.stack.rpc, reader.id);
  for (const run of [owner, reader])
    expect(await autoLinkMoment(b, run.id)).toMatchObject({
      autoLinkId: null,
      failure: "cycle",
      fromTicketKey: "BOU-12",
      toTicketKey: "BOU-18",
    });
  expect(await autoLinksOf(b.stack.rpc, b.project.id)).toEqual([]);
  expect((await snapshotOf(b.stack.rpc, b.project.id)).links).toHaveLength(1);
  release(b.stack, owner);
  await finished(b.stack.rpc, owner.id);
}, 90_000);
