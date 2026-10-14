import { expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AskInput, type ProjectMeta, type Ticket, VALIDATION_OPTIONS } from "@kibo/schema";
import { createProjectSettings } from "../notes/settings";
import { nodeImageFs, questionImagesDir } from "../questions/question-images";
import { imagesTmp, writeImage } from "../questions/question-images.test-helper";
import { call, createService } from "../service";
import { openStore } from "../store";
import { createDataPort } from "./data-port";

function setup() {
  const root = imagesTmp();
  const store = openStore(join(root, "kibo"));
  const s = createService(store, { user: "adam" });
  const meta: ProjectMeta = call(s, {
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  });
  const ticket = s.handle({
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Écran d'accès" },
  }) as Ticket;
  const lines: string[] = [];
  const home = join(root, "kibo");
  const port = createDataPort(s.docs, createProjectSettings(store.db), Date.now, undefined, {
    home,
    notesDir: () => join(root, "notes"),
    fs: nodeImageFs,
    log: (line) => lines.push(line),
  });
  const run = { id: "r1", profileName: "emis-livraison", cwd: join(root, "worktree") };
  const ask = (input: Partial<AskInput>) =>
    port.createQuestion(
      meta.id,
      ticket.id,
      run,
      AskInput.parse({
        title: "Valider l'écran 1.2 ?",
        context: "",
        options: [],
        provisional: null,
        blocking: true,
        ...input,
      }),
    );
  return { root, home, lines, ask };
}

test("a validation question gets its two options and the metadata of its allowed images only", () => {
  const { root, home, lines, ask } = setup();
  const question = ask({
    kind: "validation",
    options: ["Oui"],
    images: [
      writeImage(join(root, "worktree/shots/1-no-access.png")),
      writeImage(join(root, "notes/2-list.png")),
      writeImage(join(root, "elsewhere/3.png")),
    ],
  });
  if (!question) throw new Error("question expected");
  expect(question.kind).toBe("validation");
  expect(question.options).toEqual([...VALIDATION_OPTIONS]);
  expect(question.blocking).toBe(true);
  expect(question.images.map((i) => [i.name, i.width, i.height])).toEqual([
    ["1-no-access.png", 800, 600],
    ["2-list.png", 800, 600],
  ]);
  expect(JSON.stringify(question)).not.toContain(root);
  expect(JSON.stringify(question)).not.toContain("/Users");
  for (const image of question.images)
    expect(existsSync(join(questionImagesDir(home, question.id), `${image.id}.png`))).toBe(true);
  expect(lines).toEqual(["image omise 3.png : hors des dossiers permis"]);
});

test("an ordinary question keeps its options and has no image", () => {
  const { home, ask } = setup();
  const question = ask({ options: ["80", "443"] });
  expect(question?.kind).toBe("question");
  expect(question?.options).toEqual(["80", "443"]);
  expect(question?.images).toEqual([]);
  expect(existsSync(questionImagesDir(home, question?.id ?? ""))).toBe(false);
});

test("asking again an open question stores no second copy of its images", () => {
  const { root, home, ask } = setup();
  const shot = writeImage(join(root, "worktree/1.png"));
  const first = ask({ kind: "validation", images: [shot] });
  const again = ask({ kind: "validation", images: [shot] });
  expect(again?.id).toBe(first?.id);
  expect(again?.images).toEqual(first?.images ?? []);
  const dir = questionImagesDir(home, first?.id ?? "");
  expect(readdirSync(dir)).toHaveLength(1);
});
