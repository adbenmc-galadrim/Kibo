import { describe, expect, test } from "bun:test";
import { readProject } from "./commands";
import { commitDefaults, commitMessage, commitSubject, prBody, ticketKeyFromBranch } from "./commit-message";
import { createProjectDoc } from "./project";
import { createTicket } from "./tickets";

describe("ticketKeyFromBranch", () => {
  test("finds the project key in common branch names, case-insensitively", () => {
    expect(ticketKeyFromBranch("kib-12", "KIB")).toBe("KIB-12");
    expect(ticketKeyFromBranch("feat/KIB-12-schema-loro", "KIB")).toBe("KIB-12");
    expect(ticketKeyFromBranch("agent/kib-007", "KIB")).toBe("KIB-7");
  });
  test("ignores other keys, partial words and detached heads", () => {
    expect(ticketKeyFromBranch("feat/API-3", "KIB")).toBeNull();
    expect(ticketKeyFromBranch("kibble-12", "KIB")).toBeNull();
    expect(ticketKeyFromBranch("xkib-12", "KIB")).toBeNull();
    expect(ticketKeyFromBranch(null, "KIB")).toBeNull();
  });
});

describe("messages", () => {
  test("subject lowercases the first letter, drops a trailing parenthesis and keeps acronyms", () => {
    expect(commitSubject({ key: "KIB-12", title: "Schéma Loro des tickets (LoroTree)" }, null)).toBe(
      "feat: schéma Loro des tickets (KIB-12)",
    );
    expect(commitSubject({ key: "KIB-12", title: "Schéma Loro des tickets" }, "core")).toBe(
      "feat(core): schéma Loro des tickets (KIB-12)",
    );
    expect(commitSubject({ key: "KIB-3", title: "API de facturation" }, null)).toBe(
      "feat: API de facturation (KIB-3)",
    );
    expect(commitSubject({ key: "KIB-4", title: "(WIP)" }, null)).toBe("feat: (WIP) (KIB-4)");
  });
  test("body lists the done sub-tickets", () => {
    expect(
      commitMessage({
        ticket: { key: "KIB-12", title: "Schéma Loro des tickets" },
        scope: null,
        doneChildren: ["LoroTree pour les sous-tickets", "index SQLite dérivé"],
      }),
    ).toBe(
      "feat: schéma Loro des tickets (KIB-12)\n\n- LoroTree pour les sous-tickets\n- index SQLite dérivé",
    );
    expect(commitMessage({ ticket: { key: "KIB-1", title: "Titre" }, scope: null, doneChildren: [] })).toBe(
      "feat: titre (KIB-1)",
    );
    expect(commitMessage({ ticket: null, scope: null, doneChildren: [] })).toBe("");
  });
  test("PR body has one section per available information", () => {
    expect(
      prBody({
        ticket: { key: "KIB-12", title: "Schéma Loro des tickets" },
        commitSubjects: ["feat: opérations move", "test: convergence"],
        children: [
          { key: "KIB-24", done: true },
          { key: "KIB-27", done: false },
        ],
        mockupUrl: null,
      }),
    ).toBe(
      "## Ticket\nKIB-12 · Schéma Loro des tickets\n\n## Changements\n- feat: opérations move\n- test: convergence\n\n## Sous-tickets\n- [x] KIB-24\n- [ ] KIB-27",
    );
    expect(
      prBody({
        ticket: null,
        commitSubjects: [],
        children: [],
        mockupUrl: "https://penpot.example/maquette",
      }),
    ).toBe("## Maquette\nhttps://penpot.example/maquette");
  });
});

test("commitDefaults reads the ticket named by the branch", () => {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: "/repo", color: "#F97316" });
  const parent = createTicket(doc, { title: "Schéma Loro des tickets (LoroTree)" });
  createTicket(doc, { title: "Index SQLite dérivé", parentId: parent.id, statusId: "done" });
  const d = commitDefaults(readProject(doc), "kib-1", ["feat: premier jet"]);
  expect(d).toEqual({
    ticketId: parent.id,
    ticketKey: "KIB-1",
    message: "feat: schéma Loro des tickets (KIB-1)\n\n- Index SQLite dérivé",
    prTitle: "feat: schéma Loro des tickets (KIB-1)",
    prBody:
      "## Ticket\nKIB-1 · Schéma Loro des tickets (LoroTree)\n\n## Changements\n- feat: premier jet\n\n## Sous-tickets\n- [x] KIB-2",
  });
  expect(commitDefaults(readProject(doc), "main", ["chore: x"])).toEqual({
    ticketId: null,
    ticketKey: null,
    message: "",
    prTitle: "chore: x",
    prBody: "## Changements\n- chore: x",
  });
  expect(commitDefaults(readProject(doc), "kib-99", []).prTitle).toBe("");
});
