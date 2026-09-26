import { describe, expect, test } from "bun:test";
import { readDraftManifest } from "./draft-files";
import { cleanPublishHomes, hashOf, ID, publishedAi as published, setup } from "./testing/publish-setup";

cleanPublishHomes();

describe("details", () => {
  test("create: diff of changed agent files, version 0.1.0, every permission is new, no hash yet", async () => {
    const { publisher, diffs } = await setup();
    const d = await publisher.details(ID);
    expect(diffs).toEqual(["ui.tsx"]);
    expect(d.manifest?.id).toBe("burndown");
    expect(d.publish).toMatchObject({
      id: "burndown",
      title: "Burndown",
      from: null,
      to: "0.1.0",
      status: "new",
      newPermissions: ["read:ticket"],
      hash: null,
      changes: [],
      migration: null,
      validation: { ok: true },
    });
  });
  test("modify: patch proposed and the first line of the request as change", async () => {
    const { publisher } = await setup({ mode: "modify", published });
    expect((await publisher.details(ID)).publish).toMatchObject({
      from: "0.1.0",
      to: "0.1.1",
      status: "update",
      changes: ["Ajoute un titre"],
      newPermissions: [],
    });
  });
  test("no diff, manifest nor preview before review", async () => {
    const { publisher } = await setup({ status: "failed" });
    expect(await publisher.details(ID)).toMatchObject({ diff: [], manifest: null, publish: null });
  });
});

describe("review", () => {
  test("writes version and changes, moves to permissions, exposes the hash", async () => {
    const { publisher, paths } = await setup({ mode: "modify", published });
    const d = await publisher.review({ draftId: ID, version: "0.1.1", changes: ["Ajoute un titre"] });
    expect(d.status).toBe("permissions");
    expect(readDraftManifest(paths.dir)).toMatchObject({ version: "0.1.1", changes: ["Ajoute un titre"] });
    expect(d.publish).toMatchObject({ to: "0.1.1", hash: hashOf(paths.dir), changes: ["Ajoute un titre"] });
  });
  test("refuses a version not above the published one, or a draft not in review", async () => {
    const { publisher } = await setup({ mode: "modify", published });
    await expect(publisher.review({ draftId: ID, version: "0.1.0", changes: [] })).rejects.toThrow(
      "INVALID_INPUT",
    );
    const created = await setup({ published: { ...published, origin: "user" } });
    await expect(created.publisher.review({ draftId: ID, version: "0.1.0", changes: [] })).rejects.toThrow(
      "INVALID_INPUT",
    );
    const other = await setup({ status: "failed" });
    await expect(other.publisher.review({ draftId: ID, version: "0.1.0", changes: [] })).rejects.toThrow(
      "INVALID_INPUT",
    );
  });
});
