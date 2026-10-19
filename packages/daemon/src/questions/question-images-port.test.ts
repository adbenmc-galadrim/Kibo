import { expect, spyOn, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Question } from "@kibo/schema";
import { nodeImageFs, questionImagesDir } from "./question-images";
import { imagesTmp, removalFs, writeImage } from "./question-images.test-helper";
import { questionImageFiles, questionImagesOf } from "./question-images-port";

const question = (images: Question["images"]) =>
  Question.parse({
    id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    ticketId: "t1",
    runId: "r1",
    title: "Valider ?",
    context: "",
    options: [],
    provisional: null,
    blocking: true,
    createdBy: { kind: "agent", ref: "silo-livraison" },
    createdAt: 1,
    answer: null,
    kind: "validation",
    images,
  });

test("the delivery root of the project is the third allowed folder", () => {
  const root = imagesTmp();
  const lines: string[] = [];
  const deps = {
    home: join(root, "kibo"),
    notesDir: () => null,
    fs: nodeImageFs,
    log: (l: string) => lines.push(l),
  };
  const port = questionImagesOf(deps, (projectId) => (projectId === "p1" ? join(root, "silo") : null));
  const shot = writeImage(join(root, "silo/docs/1.png"));
  expect(port.prepare("p1", null, [shot]).map((p) => p.image.name)).toEqual(["1.png"]);
  expect(port.prepare("p2", null, [shot])).toEqual([]);
  expect(lines).toEqual(["image omise 1.png : hors des dossiers permis"]);
});

test("only the images the question kept are copied", () => {
  const root = imagesTmp();
  const deps = {
    home: join(root, "kibo"),
    notesDir: () => join(root, "notes"),
    fs: nodeImageFs,
    log: () => {},
  };
  const port = questionImagesOf(deps, () => null);
  const prepared = port.prepare("p1", null, [writeImage(join(root, "notes/1.png"))]);
  port.store(question([]), prepared);
  expect(existsSync(join(root, "kibo"))).toBe(false);
  const kept = question(prepared.map((p) => p.image));
  port.store(kept, prepared);
  expect(readdirSync(questionImagesDir(deps.home, kept.id))).toHaveLength(1);
});

test("without an image store, the paths are omitted and the omission is logged", () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  const port = questionImagesOf(null, () => null);
  expect(port.prepare("p1", "/repo", ["/repo/1.png", "/repo/2.png"])).toEqual([]);
  expect(warn.mock.calls[0]?.[0]).toContain("2 image(s)");
  warn.mockRestore();
});

test("the image files of the daemon live under its home and are read back for the route", () => {
  const root = imagesTmp();
  const files = questionImageFiles(join(root, "kibo"), () => join(root, "notes"));
  const port = questionImagesOf(files, () => null);
  const prepared = port.prepare("p1", null, [writeImage(join(root, "notes/1.png"))]);
  const kept = question(prepared.map((p) => p.image));
  port.store(kept, prepared);
  const id = prepared[0]?.image.id ?? "";
  expect(files.read(kept.id, id)?.mime).toBe("image/png");
  expect(files.read(kept.id, "00000000-0000-4000-8000-000000000000")).toBeNull();
});

const QUESTION_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

test("removing the images of a question removes its folder under the home of the daemon", () => {
  const fs = removalFs();
  const port = questionImagesOf({ home: "/home/kibo", notesDir: () => null, fs, log: () => {} }, () => null);
  port.remove(QUESTION_ID);
  expect(fs.removed).toEqual([questionImagesDir("/home/kibo", QUESTION_ID)]);
});

test("without an image store, removing images does nothing", () => {
  expect(() => questionImagesOf(null, () => null).remove(QUESTION_ID)).not.toThrow();
});

test("a folder that cannot be removed is logged and the removal does not fail", () => {
  const lines: string[] = [];
  const fs = removalFs(new Error("EACCES"));
  const port = questionImagesOf(
    { home: "/home/kibo", notesDir: () => null, fs, log: (l) => lines.push(l) },
    () => null,
  );
  expect(() => port.remove(QUESTION_ID)).not.toThrow();
  expect(lines).toEqual([`images de la question ${QUESTION_ID} non effacées : EACCES`]);
});
