import { expect, test } from "bun:test";
import { PROJECT_AGENT_TOOLS } from "@kibo/schema";
import { type DiffLabels, defaultLabels } from "./batch-groups";
import { readingText } from "./reading-text";

const SHORT_KEYS: Record<string, string> = { "SILO-30": "F5" };
const labels: DiffLabels = {
  ...defaultLabels,
  feature: (key) => ({ label: SHORT_KEYS[key] ?? key, sprint: null }),
};

test("the daily point reads like the mockup", () => {
  expect(readingText(["list_sprints", "get_ticket SILO-30", "project_changes"], labels)).toBe(
    "Lu : Planning, F5, journal des étapes",
  );
});

test("objects are named, never their raw parameters", () => {
  expect(
    readingText(
      [
        "project_overview",
        "list_questions state=open",
        "list_tickets status=review label=ui",
        "read_note pilotage/plan.md",
        "read_note agent-de-projet/memoire.md",
      ],
      labels,
    ),
  ).toBe("Lu : Vue d'ensemble, questions ouvertes, Tickets, note plan, note mémoire");
});

test("a step keeps its key, questions say their state and feature, repeats are said once", () => {
  expect(
    readingText(
      [
        "get_ticket SILO-45",
        "list_questions",
        "list_questions state=answered ticketKey=SILO-30",
        "list_questions state=archived",
        "list_questions state=all",
        "get_ticket SILO-45",
      ],
      labels,
    ),
  ).toBe("Lu : SILO-45, questions ouvertes, questions répondues de F5, questions archivées, questions");
});

test("without project labels a ticket is said by its key", () => {
  expect(readingText(["get_ticket SILO-30"])).toBe("Lu : SILO-30");
});

test("every read tool has a French label free of technical names", () => {
  const reads = PROJECT_AGENT_TOOLS.filter((tool) => tool !== "propose_batch");
  for (const tool of reads) {
    const text = readingText([tool], labels);
    expect(text).not.toContain("=");
    expect(text).not.toContain("_");
  }
});
