import { describe, expect, test } from "bun:test";
import { insertSkill, skillTrigger } from "./skill-trigger";

describe("skillTrigger", () => {
  test("a slash at the start of the message opens with an empty query", () => {
    expect(skillTrigger("/", 1)).toEqual({ start: 0, query: "" });
  });

  test("the text typed after the slash up to the caret is the query", () => {
    expect(skillTrigger("/brain", 6)).toEqual({ start: 0, query: "brain" });
    expect(skillTrigger("/brain", 3)).toEqual({ start: 0, query: "br" });
  });

  test("a slash after a space or a line break opens too", () => {
    expect(skillTrigger("Relis avec /rev", 15)).toEqual({ start: 11, query: "rev" });
    expect(skillTrigger("Bonjour\n/sup:br", 15)).toEqual({ start: 8, query: "sup:br" });
  });

  test("a slash inside a word, an url or a finished word does not open", () => {
    expect(skillTrigger("a/b", 3)).toBeNull();
    expect(skillTrigger("https://x.dev", 13)).toBeNull();
    expect(skillTrigger("/brainstorming ", 15)).toBeNull();
    expect(skillTrigger("/Brain", 6)).toBeNull();
    expect(skillTrigger("texte", 5)).toBeNull();
  });
});

describe("insertSkill", () => {
  test("replaces the typed slash word by the skill and a space, caret after it", () => {
    expect(insertSkill("/bra", { start: 0, query: "bra" }, "brainstorming")).toEqual({
      text: "/brainstorming ",
      caret: 15,
    });
  });

  test("keeps the text around and the rest of the word after the caret", () => {
    const text = "Relis /re la PR";
    expect(insertSkill(text, { start: 6, query: "re" }, "review-pr")).toEqual({
      text: "Relis /review-pr la PR",
      caret: 17,
    });
  });
});
