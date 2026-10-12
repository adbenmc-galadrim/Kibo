import { expect, test } from "bun:test";
import { hasSecret, KiboError, type RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { cleanSkillDirs, tempDir } from "./fakes.test-helper";
import { createSkillReviews } from "./reviews";
import { openSkillReviewStore } from "./reviews-store";

cleanSkillDirs();

const SECRET = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";
const adam = { kind: "human" as const, ref: "adam" };

function rig(used: string[] = ["a"]) {
  const emitted: string[] = [];
  const store = openSkillReviewStore(tempDir());
  let at = 100;
  const reviews = createSkillReviews({
    store,
    uses: { byRun: () => used.map((skillId) => ({ skillId, count: 1 })) },
    skillPath: (id) => (id === "a" ? { path: "/claude/skills/a", hash: "h".repeat(64) } : null),
    emit: (topic) => emitted.push(topic),
    now: () => at++,
  });
  return { reviews, store, emitted };
}

const ticketRun: RunView = runView({ id: "r1", label: "kib · livraison · KIB-14", agentName: "livraison" });
const improve = { skill: "a", verdict: "improve", note: "l1\nl2", suggestion: { content: "# A v2" } };

async function refusal(promise: Promise<unknown>): Promise<KiboError> {
  const e = await promise.catch((error: unknown) => error);
  if (!(e instanceof KiboError)) throw new Error(`expected a KiboError, got ${String(e)}`);
  return e;
}

test("a review of a used skill is stored with the run, the skill path and its hash", async () => {
  const { reviews, store, emitted } = rig();
  expect(await reviews.record(ticketRun, { reviews: [improve] })).toBe("1 review enregistrée");
  const [stored] = store.byRun("r1");
  expect(stored).toMatchObject({
    runId: "r1",
    runLabel: "kib · livraison · KIB-14",
    agentName: "livraison",
    projectId: "p1",
    ticketId: "t1",
    ticketKey: "KIB-14",
    skillId: "a",
    skillPath: "/claude/skills/a",
    baseHash: "h".repeat(64),
    verdict: "improve",
    note: "l1\nl2",
    suggestion: "# A v2",
    status: "new",
  });
  expect(emitted).toEqual(["skills"]);
  expect(reviews.hasReview("r1")).toBe(true);
  expect(reviews.hasReview("r2")).toBe(false);
});

test("a skill the run did not use is refused and nothing is written", async () => {
  const { reviews, store, emitted } = rig();
  const e = await refusal(reviews.record(ticketRun, { reviews: [improve, { ...improve, skill: "zzz" }] }));
  expect(e.code).toBe("INVALID_INPUT");
  expect(e.detail).toContain("skill non utilisé par ce run");
  expect(store.byRun("r1")).toEqual([]);
  expect(emitted).toEqual([]);
});

test("an invalid call is refused: four lines, no review, a bad verdict", async () => {
  const { reviews, store } = rig();
  for (const input of [
    { reviews: [{ ...improve, note: "1\n2\n3\n4" }] },
    { reviews: [] },
    { reviews: [{ ...improve, verdict: "bof" }] },
    "texte",
  ]) {
    expect((await refusal(reviews.record(ticketRun, input))).code).toBe("INVALID_INPUT");
  }
  expect(store.byRun("r1")).toEqual([]);
});

test("a skill unknown to Kibo but used is stored without path", async () => {
  const { reviews, store } = rig(["a", "superpowers:x"]);
  const input = { reviews: [{ skill: "superpowers:x", verdict: "ok", note: "Rien." }] };
  expect(await reviews.record(ticketRun, input)).toBe("1 review enregistrée");
  expect(store.byRun("r1")[0]).toMatchObject({ skillPath: null, baseHash: null, suggestion: null });
});

test("a second review of the same skill replaces the first", async () => {
  const { reviews, store } = rig(["a", "b"]);
  await reviews.record(ticketRun, { reviews: [improve] });
  const ok = { skill: "b", verdict: "ok", note: "Bien." };
  expect(await reviews.record(ticketRun, { reviews: [{ ...improve, note: "v2" }, ok] })).toBe(
    "2 reviews enregistrées",
  );
  expect(store.byRun("r1").map((r) => [r.skillId, r.note, r.status])).toEqual([
    ["a", "l1\nl2", "replaced"],
    ["a", "v2", "new"],
    ["b", "Bien.", "new"],
  ]);
  expect(reviews.list({ skillId: "a" }).filter((r) => r.status === "new")).toHaveLength(1);
});

test("a secret in the note or the suggestion is masked", async () => {
  const { reviews, store } = rig();
  const input = {
    reviews: [{ ...improve, note: `token ${SECRET}`, suggestion: { content: `x ${SECRET}` } }],
  };
  await reviews.record(ticketRun, input);
  const [stored] = store.byRun("r1");
  expect(hasSecret(stored?.note ?? "")).toBe(false);
  expect(hasSecret(stored?.suggestion ?? "")).toBe(false);
});

test("a project run may leave a review", async () => {
  const { reviews } = rig();
  const projectRun = runView({ id: "r9", kind: "project", ticketId: null, ticketKey: null });
  expect(await reviews.record(projectRun, { reviews: [improve] })).toBe("1 review enregistrée");
  expect(reviews.list({ runId: "r9" })[0]).toMatchObject({ ticketKey: null, ticketId: null });
});

test("ignore and integrate decide a review once and emit", async () => {
  const { reviews, emitted } = rig();
  await reviews.record(ticketRun, { reviews: [improve] });
  const [first] = reviews.list({ runId: "r1" });
  if (!first) throw new Error("no review");
  expect(reviews.decide(first.id, "ignore", adam)).toMatchObject({ status: "ignored", decidedBy: adam });
  expect(reviews.markIntegrated(first.id, "v1", adam).status).toBe("ignored");
  expect(emitted).toEqual(["skills", "skills", "skills"]);
  await reviews.record(ticketRun, { reviews: [improve] });
  const fresh = reviews.list({ runId: "r1" }).find((r) => r.status === "new");
  if (!fresh) throw new Error("no new review");
  expect(reviews.markIntegrated(fresh.id, "v2", adam)).toMatchObject({
    status: "integrated",
    versionId: "v2",
  });
  expect(() => reviews.decide("nope", "ignore", adam)).toThrow("not found");
});

test("listing needs a skill or a run and can combine both", async () => {
  const { reviews } = rig(["a", "b"]);
  await reviews.record(ticketRun, { reviews: [improve, { skill: "b", verdict: "ok", note: "Bien." }] });
  expect(reviews.list({ runId: "r1", skillId: "b" }).map((r) => r.skillId)).toEqual(["b"]);
  expect(() => reviews.list({})).toThrow(KiboError);
});
