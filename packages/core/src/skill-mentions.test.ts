import { describe, expect, test } from "bun:test";
import { rewriteSkillMentions } from "./skill-mentions";

const known = new Set(["brainstorming", "superpowers:brainstorming", "review-pr"]);
const rewrite = (text: string) => rewriteSkillMentions(text, known);

describe("rewriteSkillMentions", () => {
  test("a leading skill becomes an explicit instruction with its arguments", () => {
    expect(rewrite("/brainstorming sur la page d'accueil")).toBe(
      "Utilise le skill `brainstorming` (outil Skill) avec : sur la page d'accueil",
    );
  });

  test("a leading skill alone", () => {
    expect(rewrite("/superpowers:brainstorming")).toBe(
      "Utilise le skill `superpowers:brainstorming` (outil Skill).",
    );
  });

  test("a skill after a blank is named inline", () => {
    expect(rewrite("Relis la PR avec /review-pr puis\n/brainstorming ensuite")).toBe(
      "Relis la PR avec le skill `review-pr` (outil Skill) puis\nle skill `brainstorming` (outil Skill) ensuite",
    );
  });

  test("unknown slashes, paths and urls are left untouched", () => {
    const text = "/compact puis lis /usr/bin et https://x.dev/review-pr et a/brainstorming";
    expect(rewrite(text)).toBe(text);
  });

  test("a mention glued to punctuation is not a skill", () => {
    expect(rewrite("/brainstorming, merci")).toBe("/brainstorming, merci");
  });

  test("a text without slash is unchanged", () => {
    expect(rewrite("Oui, utilise gh.")).toBe("Oui, utilise gh.");
  });
});
