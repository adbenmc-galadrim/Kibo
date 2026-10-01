import { expect } from "bun:test";
import type { DraftAttachmentInput } from "@kibo/schema";
import { draftPaths } from "../draft-files";
import { create, done, setupLifecycle } from "./lifecycle-fixture";

export const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
export const png = (name: string): DraftAttachmentInput => ({
  name,
  mime: "image/png",
  data: Buffer.from(PNG).toString("base64"),
});
export const gif = (name: string): DraftAttachmentInput => ({
  name,
  mime: "image/png",
  data: Buffer.from("GIF89a......").toString("base64"),
});
export const feedback = "Mets le total en gros";

export async function reviewed(images: DraftAttachmentInput[] = [png("a.png")]) {
  const setup = setupLifecycle();
  const d = await setup.life.start({ ...create, attachments: images });
  setup.runs.end(d.runId ?? "", done());
  await setup.life.idle();
  expect(setup.store.get(d.id).status).toBe("review");
  return { ...setup, d, paths: draftPaths(setup.home, d.id) };
}
