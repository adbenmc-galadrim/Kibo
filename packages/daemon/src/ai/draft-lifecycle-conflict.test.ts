import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { draftPaths } from "./draft-files";
import { applyDraftEvent } from "./draft-machine";
import { installDraft } from "./draft-source";
import {
  burndownAt,
  cleanLifecycles,
  create,
  done,
  setupLifecycle,
  writeSource,
} from "./testing/lifecycle-fixture";

cleanLifecycles();

const modify = { mode: "modify", id: "burndown", description: "Ajoute un titre" } as const;
const alreadyOpen = expect.objectContaining({
  code: "CONFLICT",
  detail: "a draft of burndown is already open",
});

describe("one active draft per component (I43)", () => {
  test("a published component takes a single draft, modify or create", async () => {
    const { srcRoot, store, life } = setupLifecycle({ published: burndownAt("0.1.0") });
    writeSource(srcRoot);
    const first = await life.start(modify);
    await expect(life.start(modify)).rejects.toThrow(alreadyOpen);
    await expect(life.start(create)).rejects.toThrow(alreadyOpen);
    expect(store.active().map((d) => d.id)).toEqual([first.id]);
  });

  test("a reserved id cannot be modified while its create draft is open", async () => {
    const { life } = setupLifecycle();
    await life.start(create);
    await expect(life.start(modify)).rejects.toThrow(alreadyOpen);
  });

  test("a create draft already published but not finalized still blocks a modify", async () => {
    const { home, srcRoot, runs, store, life, setPublished } = setupLifecycle();
    const d = await life.start(create);
    runs.end("run-1", done());
    await life.idle();
    store.save(applyDraftEvent(store.get(d.id), { type: "reviewed" }, 2_000));
    installDraft(draftPaths(home, d.id).dir, join(srcRoot, "burndown")).commit();
    setPublished(burndownAt("0.1.0"));
    await expect(life.start(modify)).rejects.toThrow(alreadyOpen);
  });

  test("an abandoned draft frees the component for the next one", async () => {
    const { srcRoot, life } = setupLifecycle({ published: burndownAt("0.1.0") });
    writeSource(srcRoot);
    const first = await life.start(modify);
    life.abandon(first.id);
    await expect(life.start(modify)).resolves.toMatchObject({ status: "generating" });
  });
});
