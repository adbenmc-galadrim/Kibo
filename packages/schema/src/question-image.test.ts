import { expect, test } from "bun:test";
import { ProjectCommand } from "./command";
import { AskInput, Question } from "./question";
import { askInputFromTool } from "./question-ask";
import {
  correctionAnswer,
  QUESTION_IMAGE_LIMITS,
  QuestionImage,
  VALIDATION_OPTIONS,
  validationAsk,
} from "./question-image";

const ASK = { title: "Valider l'écran 1.2 ?", context: "", options: [], provisional: null, blocking: false };

test("an ask is an ordinary question without images by default", () => {
  const parsed = AskInput.parse(ASK);
  expect(parsed.kind).toBe("question");
  expect(parsed.images).toEqual([]);
});

test("an ask carries at most six images", () => {
  const images = (n: number) => Array.from({ length: n }, (_, i) => `/tmp/shot-${i}.png`);
  expect(QUESTION_IMAGE_LIMITS).toEqual({
    count: 6,
    bytes: 5_242_880,
    extensions: ["png", "jpg", "jpeg", "webp"],
  });
  expect(AskInput.safeParse({ ...ASK, kind: "validation", images: images(6) }).success).toBe(true);
  expect(AskInput.safeParse({ ...ASK, kind: "validation", images: images(7) }).success).toBe(false);
  expect(AskInput.safeParse({ ...ASK, kind: "vote" }).success).toBe(false);
});

test("a validation imposes its two options, no provisional choice, and blocks", () => {
  const ask = validationAsk(AskInput.parse({ ...ASK, kind: "validation", options: ["x"], provisional: "x" }));
  expect(ask.options).toEqual([...VALIDATION_OPTIONS]);
  expect(VALIDATION_OPTIONS).toEqual(["Valider", "Demander une correction"]);
  expect(ask.provisional).toBeNull();
  expect(ask.blocking).toBe(true);
  expect(ask.kind).toBe("validation");
  expect(AskInput.safeParse(ask).success).toBe(true);
});

test("a stored question without kind or images reads as an ordinary question", () => {
  const stored = {
    id: "q1",
    ticketId: "t1",
    runId: null,
    title: "x",
    context: "",
    options: [],
    provisional: null,
    blocking: false,
    createdBy: { kind: "agent", ref: "kibo" },
    createdAt: 1,
    answer: null,
  };
  const question = Question.parse(stored);
  expect(question.kind).toBe("question");
  expect(question.images).toEqual([]);
  const image = { id: "i1", name: "1-no-access.png", bytes: 1200, width: 800, height: null };
  expect(QuestionImage.parse(image)).toEqual(image);
  expect(Question.parse({ ...stored, kind: "validation", images: [image] }).images).toEqual([image]);
});

test("a correction request is a text answer with a fixed prefix", () => {
  expect(correctionAnswer("le titre")).toBe("Demander une correction : le titre");
  expect(correctionAnswer("  le titre  ")).toBe("Demander une correction : le titre");
});

test("the ask tools read the kind and the image paths, keeping the first six strings", () => {
  const paths = Array.from({ length: 7 }, (_, i) => `/repo/shots/${i}.png`);
  const ask = askInputFromTool({ question: "Valider ?", kind: "validation", images: paths }, true);
  expect(ask?.kind).toBe("validation");
  expect(ask?.images).toEqual(paths.slice(0, 6));
  expect(askInputFromTool({ question: "x", images: [3, "/a.png", ""] }, true)?.images).toEqual(["/a.png"]);
  expect(askInputFromTool({ question: "x", kind: "vote" }, true)?.kind).toBe("question");
  expect(askInputFromTool({ question: "x", images: "/a.png" }, true)?.images).toEqual([]);
});

test("createQuestion carries a kind and image metadata, never a path", () => {
  const image = { id: "i1", name: "1-no-access.png", bytes: 1200, width: 800, height: 600 };
  const command = {
    method: "createQuestion",
    ticketId: "1@1",
    title: "Valider ?",
    createdBy: { kind: "agent", ref: "dev" },
    kind: "validation",
    images: [image],
  };
  expect(ProjectCommand.parse(command)).toMatchObject({ kind: "validation", images: [image] });
  expect(ProjectCommand.safeParse({ ...command, images: ["/Users/a/x.png"] }).success).toBe(false);
});
