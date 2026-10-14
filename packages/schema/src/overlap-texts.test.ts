import { expect, test } from "bun:test";
import type { OverlapDetail } from "./overlap";
import {
  autoLinkFailure,
  autoLinkSummary,
  OVERLAP_SUMMARY_MAX,
  overlapAlert,
  overlapStopReminder,
  overlapSummary,
  PARALLEL_RULES,
  PARALLEL_RULES_TITLE,
  WORK_SECTION_FOOTER,
  WORK_SECTION_OVERLAPS,
  WORK_SECTION_TITLE,
} from "./overlap-texts";

const RUN = "boutique · livraison · BOU-12";
const EXPORT: OverlapDetail = {
  kind: "export",
  name: "formatDate",
  ownerPath: "src/lib/format.ts",
  otherPath: "src/utils/date.ts",
};
const FILE: OverlapDetail = { kind: "file", path: "src/i18n/fr.ts" };
const BLOCK: OverlapDetail = {
  kind: "block",
  ownerPath: "src/http.ts",
  ownerStart: 12,
  otherPath: "src/api/client.ts",
  otherStart: 40,
  lines: 14,
  chars: 420,
};

test("the summary of an overlap names the other run and both sides", () => {
  expect(overlapSummary(EXPORT, RUN)).toBe(
    "Recouvrement avec boutique · livraison · BOU-12 : `formatDate` exporté deux fois (`src/utils/date.ts`, chez lui `src/lib/format.ts`)",
  );
  expect(overlapSummary(FILE, RUN)).toBe(
    "Recouvrement avec boutique · livraison · BOU-12 : `src/i18n/fr.ts` modifié des deux côtés",
  );
  expect(overlapSummary(BLOCK, RUN)).toBe(
    "Recouvrement avec boutique · livraison · BOU-12 : 14 lignes identiques (`src/api/client.ts:40`, chez lui `src/http.ts:12`)",
  );
});

test("the owner's summary starts from its own side", () => {
  expect(overlapSummary(EXPORT, "boutique · livraison · BOU-15", "owner")).toBe(
    "Recouvrement avec boutique · livraison · BOU-15 : `formatDate` exporté deux fois (`src/lib/format.ts`, chez lui `src/utils/date.ts`)",
  );
});

test("a summary is bounded and masks secrets", () => {
  const long = overlapSummary({ kind: "file", path: "a/".repeat(200) }, RUN);
  expect(long.length).toBeLessThanOrEqual(OVERLAP_SUMMARY_MAX);
  expect(long.endsWith("…")).toBe(true);
  const secret = overlapSummary({ ...EXPORT, name: "ghp_abcdefghijklmnopqrstuvwxyz" }, RUN);
  expect(secret).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz");
});

const REUSE =
  'Si c\'est le même code, reprends le sien (`mcp__kibo__peek_work { run: "BOU-12", path: "src/lib/format.ts" }`, copie à l\'identique au même chemin) ou factorise ; sinon continue. Rien à justifier.';

test("the other run is informed, never told to stop or justify", () => {
  const alert = overlapAlert("other", EXPORT, RUN, "BOU-12");
  expect(alert).toBe(
    `Kibo — information : \`formatDate\` est aussi exporté par boutique · livraison · BOU-12 (\`src/lib/format.ts\`, toi \`src/utils/date.ts\`). ${REUSE}`,
  );
  expect(alert.startsWith("Kibo — information : ")).toBe(true);
  expect(alert).toContain("Rien à justifier");
  expect(alert).not.toContain("sans demander");
  const block = overlapAlert("other", BLOCK, RUN, "BOU-12");
  expect(block).toContain("14 lignes de `src/api/client.ts:40` sont identiques à `src/http.ts:12`");
  expect(block).toContain('mcp__kibo__peek_work { run: "BOU-12", path: "src/http.ts" }');
  expect(block).not.toContain("sans demander");
});

test("a legacy shared file overlap is only information", () => {
  const alert = overlapAlert("other", FILE, RUN, "BOU-12");
  expect(alert.startsWith("Kibo — information : `src/i18n/fr.ts` est aussi modifié par boutique")).toBe(true);
  expect(alert).toContain("Rien à justifier");
  expect(overlapAlert("owner", FILE, "boutique · livraison · BOU-15", "BOU-15")).toBe(
    "Kibo — information : boutique · livraison · BOU-15 modifie aussi `src/i18n/fr.ts`. Rien à faire.",
  );
});

test("the owner is only informed, with nothing to do", () => {
  expect(overlapAlert("owner", EXPORT, "boutique · livraison · BOU-15", "BOU-15")).toBe(
    "Kibo — information : boutique · livraison · BOU-15 ajoute aussi un export `formatDate` (`src/utils/date.ts`). Rien à faire.",
  );
  expect(overlapAlert("owner", BLOCK, "x", "BOU-15")).toBe(
    "Kibo — information : x a 14 lignes identiques à ton code de `src/http.ts:12` (`src/api/client.ts:40`). Rien à faire.",
  );
});

test("the stop reminder cites every open overlap", () => {
  expect(overlapStopReminder([{ ticketKey: "BOU-12", label: "`formatDate`" }])).toBe(
    "Kibo : recouvrement ouvert avec BOU-12 (`formatDate`) : factorise, ou explique dans ton compte rendu pourquoi tu gardes ta copie, puis termine.",
  );
  const two = overlapStopReminder([
    { ticketKey: "BOU-12", label: "`formatDate`" },
    { ticketKey: "BOU-13", label: "`src/i18n/fr.ts`" },
  ]);
  expect(two).toContain("BOU-12 (`formatDate`)");
  expect(two).toContain("BOU-13 (`src/i18n/fr.ts`)");
  expect(two.startsWith("Kibo : recouvrements ouverts avec")).toBe(true);
});

test("an automatic link says who blocks whom and why", () => {
  expect(autoLinkSummary("BOU-12", "BOU-15", "copy", "src/lib/format-date.ts")).toBe(
    "Kibo a lié BOU-12 → BOU-15 (BOU-12 bloque BOU-15) : `src/lib/format-date.ts` repris de BOU-12",
  );
  expect(autoLinkSummary("BOU-12", "BOU-15", "import", "src/lib/format.ts")).toBe(
    "Kibo a lié BOU-12 → BOU-15 (BOU-12 bloque BOU-15) : `src/lib/format.ts` importé de BOU-12",
  );
  expect(autoLinkFailure("BOU-12", "BOU-15")).toBe(
    "Kibo n'a pas pu lier BOU-12 → BOU-15 : dépendance circulaire",
  );
});

test("the work section and the parallel rules have fixed titles", () => {
  expect(WORK_SECTION_TITLE).toBe("## Travail en cours sur le projet");
  expect(WORK_SECTION_OVERLAPS).toBe("**Recouvrements ouverts avec toi**");
  expect(PARALLEL_RULES_TITLE).toBe("## Travail en parallèle");
  expect(WORK_SECTION_FOOTER).toContain("`mcp__kibo__peek_work`");
  const rules = PARALLEL_RULES.join("\n");
  expect(rules).toContain('`mcp__kibo__peek_work { run: "BOU-12" }`');
  expect(rules).toContain("un recouvrement est une information");
  expect(rules).toContain("reprends ou factorise si c'est le même code, sinon continue");
  expect(rules).not.toContain("sans demander");
  expect(rules).not.toContain("Copie gardée");
});
