import { describe, expect, test } from "bun:test";
import { type Guideline, MEMORY_NOTE_PATH } from "@kibo/schema";
import { buildProjectAgentPrompt, firstTurnPrompt, nextTurnPrompt } from "./prompt";

const guideline = (path: string, content: string): Guideline => ({
  id: path,
  owner: { scope: "profile", profileId: "project-agent" },
  path,
  content,
});

describe("buildProjectAgentPrompt", () => {
  const prompt = buildProjectAgentPrompt({
    projectName: "Emis",
    chain: [guideline("a.md", "Toujours en français."), guideline("b.md", "Petits lots.")],
    memoryPath: MEMORY_NOTE_PATH,
    viewer: "adam",
  });

  test("states the role, the protocol, the memory and the forbidden moves", () => {
    for (const fragment of [
      "chef de projet du projet Emis",
      "propose, ne fait pas",
      "mcp__kibo__propose_batch",
      "une seule proposition par tour",
      "pourquoi",
      MEMORY_NOTE_PATH,
      "Jamais de décision prise dans ton texte final",
      "createQuestion",
      "mcp__kibo__ask_user",
      "adam",
    ]) {
      expect(prompt).toContain(fragment);
    }
  });

  test("adds the guidelines of the chain afterwards, in order", () => {
    const protocol = prompt.indexOf("propose_batch");
    const first = prompt.indexOf("Toujours en français.");
    const second = prompt.indexOf("Petits lots.");
    expect(protocol).toBeLessThan(first);
    expect(first).toBeLessThan(second);
  });

  test("is deterministic", () => {
    expect(
      buildProjectAgentPrompt({
        projectName: "Emis",
        chain: [],
        memoryPath: MEMORY_NOTE_PATH,
        viewer: "adam",
      }),
    ).toBe(
      buildProjectAgentPrompt({
        projectName: "Emis",
        chain: [],
        memoryPath: MEMORY_NOTE_PATH,
        viewer: "adam",
      }),
    );
  });
});

describe("turn prompts", () => {
  test("the first turn carries the overview, the next ones the digest, then the message", () => {
    expect(firstTurnPrompt("# Emis (EMIS)", "Fais le point.")).toBe(
      "# Projet\n\n# Emis (EMIS)\n\n# Message\n\nFais le point.",
    );
    expect(nextTurnPrompt("## Depuis ton dernier tour\n\n- Note créée : a.md", "Et maintenant ?")).toBe(
      "## Depuis ton dernier tour\n\n- Note créée : a.md\n\n# Message\n\nEt maintenant ?",
    );
  });
});
