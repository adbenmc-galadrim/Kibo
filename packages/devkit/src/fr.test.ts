import { expect, test } from "bun:test";
import { formatIssue } from "./fr";
import { issueAt } from "./issues";

test("issues are explained in French with their location", () => {
  expect(formatIssue(issueAt("ui.tsx", 3, "forbidden-import", "node:fs"))).toBe(
    "ui.tsx:3 · import interdit : node:fs",
  );
  expect(formatIssue(issueAt("ui.tsx", 7, "non-literal-argument", "useEntities"))).toBe(
    "ui.tsx:7 · argument non littéral : impossible de vérifier la permission (useEntities)",
  );
  expect(formatIssue(issueAt("server.ts", 2, "banned-identifier", "process"))).toBe(
    "server.ts:2 · identifiant interdit : process",
  );
  expect(formatIssue(issueAt("ui.tsx", 4, "unknown-entity", "moveTicket"))).toBe(
    "ui.tsx:4 · entité ou commande inconnue : moveTicket",
  );
});
