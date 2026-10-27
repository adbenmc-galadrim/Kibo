import { expect, test } from "bun:test";
import { Question } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { QuestionsSection } from "./QuestionsSection";

const LONG =
  "Ce qui valide « Préparé » : l'encodage du tag (passation) ou l'iso prêt à lancer en fabrication";

test("a long question title wraps instead of being cut", () => {
  const question = Question.parse({
    id: "q19",
    ticketId: "t1",
    runId: null,
    title: LONG,
    context: "",
    options: [],
    provisional: null,
    blocking: true,
    createdBy: { kind: "human", ref: "adam" },
    createdAt: 1,
    answer: null,
  });
  render(<QuestionsSection ticket={{ id: "t1" }} questions={[question]} onOpen={() => {}} />);
  const title = screen.getByText(LONG);
  expect(title.className).toContain("wrap-anywhere");
  expect(title.className).not.toContain("truncate");
});
