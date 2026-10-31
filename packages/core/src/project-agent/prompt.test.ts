import { describe, expect, test } from "bun:test";
import { type Guideline, MEMORY_NOTE_PATH } from "@kibo/schema";
import {
  buildProjectAgentPrompt,
  DEFAULT_PROJECT_AGENT_BODY,
  firstTurnPrompt,
  nextTurnPrompt,
} from "./prompt";

const guideline = (path: string, content: string): Guideline => ({
  id: path,
  owner: { scope: "workspace" },
  path,
  content,
});

describe("buildProjectAgentPrompt", () => {
  const prompt = buildProjectAgentPrompt({
    projectName: "Silo",
    chain: [guideline("a.md", "Toujours en français."), guideline("b.md", "Petits lots.")],
    memoryPath: MEMORY_NOTE_PATH,
    viewer: "adam",
    agentBody: "",
  });

  test("speaks of neither skills, signals nor ticket agents", () => {
    for (const fragment of ["Skill", "skill_review", "Signaux", "signal", "assignAgent", "deliverAnswers"]) {
      expect(prompt).not.toContain(fragment);
    }
  });

  test("states the role, the protocol, the memory and the forbidden moves", () => {
    for (const fragment of [
      "chef de projet du projet Silo",
      "propose, ne fait pas",
      "mcp__kibo__propose_batch",
      "une seule proposition par tour",
      "pourquoi",
      MEMORY_NOTE_PATH,
      "Jamais de décision prise dans ton texte final",
      "createQuestion",
      "mcp__kibo__ask_user",
      "adam",
      "tickets, statuts, liens, questions, notes",
    ]) {
      expect(prompt).toContain(fragment);
    }
  });

  test("the question rules follow the memory: recipients, reopening, archiving", () => {
    const questions = prompt.indexOf("## Questions");
    expect(prompt.indexOf("## Mémoire")).toBeLessThan(questions);
    expect(questions).toBeLessThan(prompt.indexOf("## Interdits"));
    for (const fragment of [
      "project_overview.recipients",
      "addRecipient",
      "reopenQuestion",
      "deleteQuestion` archive",
      "Lis `recipient` dans `list_questions`",
      "Réveillé par une réponse",
      "sans lot",
    ]) {
      expect(prompt).toContain(fragment);
    }
  });

  test("the prompt never speaks of a delivered answer", () => {
    expect(prompt).not.toContain("transmise");
    expect(prompt).not.toContain("delivered");
  });

  test("the sprint rules follow the questions: tools, actions and the end of sprint protocol", () => {
    const sprints = prompt.indexOf("## Sprints");
    expect(prompt.indexOf("## Questions")).toBeLessThan(sprints);
    expect(sprints).toBeLessThan(prompt.indexOf("## Interdits"));
    for (const fragment of [
      "mcp__kibo__list_sprints",
      "`setSprint`",
      "`createSprint`",
      "`remindQuestion`",
      "une action par fonctionnalité restante",
    ]) {
      expect(prompt).toContain(fragment);
    }
  });

  test("the hold rules follow the sprints: when to put a step on hold and when to resume it", () => {
    const holds = prompt.indexOf("## Étapes en attente");
    expect(prompt.indexOf("## Sprints")).toBeLessThan(holds);
    expect(holds).toBeLessThan(prompt.indexOf("## Interdits"));
    expect(prompt).toContain("`setHold`");
    expect(prompt).toContain("`reason: null`");
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
        projectName: "Silo",
        chain: [],
        memoryPath: MEMORY_NOTE_PATH,
        viewer: "adam",
        agentBody: "",
      }),
    ).toBe(
      buildProjectAgentPrompt({
        projectName: "Silo",
        chain: [],
        memoryPath: MEMORY_NOTE_PATH,
        viewer: "adam",
        agentBody: "",
      }),
    );
  });
});

describe("the spec of the project agent", () => {
  const input = { projectName: "Silo", chain: [], memoryPath: MEMORY_NOTE_PATH, viewer: "adam" };
  test("replaces the role lines when its file has a body", () => {
    const prompt = buildProjectAgentPrompt({ ...input, agentBody: "Tu es le chef." });
    expect(prompt).toStartWith("Tu es le chef.\n");
    expect(prompt).not.toContain("# Agent de projet Kibo");
    expect(prompt).toContain("propose_batch");
  });
  test("an empty body keeps the former prompt", () => {
    expect(buildProjectAgentPrompt({ ...input, agentBody: "" })).toContain(
      "Tu es le chef de projet du projet Silo.",
    );
    expect(buildProjectAgentPrompt({ ...input, agentBody: "  " })).toBe(
      buildProjectAgentPrompt({ ...input, agentBody: "" }),
    );
  });
  test("the default body is the role, for any project", () => {
    expect(DEFAULT_PROJECT_AGENT_BODY).toStartWith("# Agent de projet Kibo\n");
    expect(DEFAULT_PROJECT_AGENT_BODY).toContain("Tu es le chef de projet du projet courant.");
    expect(DEFAULT_PROJECT_AGENT_BODY).toContain("tu conseilles l'utilisateur");
  });
});

describe("turn prompts", () => {
  test("the first turn carries the overview, the next ones the digest, then the message", () => {
    expect(firstTurnPrompt("# Silo (SILO)", "Fais le point.")).toBe(
      "# Projet\n\n# Silo (SILO)\n\n# Message\n\nFais le point.",
    );
    expect(nextTurnPrompt("## Depuis ton dernier tour\n\n- Note créée : a.md", "Et maintenant ?")).toBe(
      "## Depuis ton dernier tour\n\n- Note créée : a.md\n\n# Message\n\nEt maintenant ?",
    );
  });
});
