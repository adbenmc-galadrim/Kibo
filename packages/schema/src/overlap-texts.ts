import type { AutoLinkReason, OverlapDetail, OverlapRole } from "./overlap";
import { DUPLICATION_LIMITS } from "./overlap-settings";
import { maskSecrets } from "./secret-mask";

export const OVERLAP_SUMMARY_MAX = DUPLICATION_LIMITS.summaryChars;
export const WORK_SECTION_TITLE = "## Travail en cours sur le projet";
export const WORK_SECTION_OVERLAPS = "**Recouvrements ouverts avec toi**";
export const WORK_SECTION_FOOTER =
  "Avant de créer un utilitaire, un type ou un composant, vérifie qu'il n'existe pas déjà dans le code ni dans ce qui précède ; `mcp__kibo__peek_work` lit le travail d'un autre run.";
export const PARALLEL_RULES_TITLE = "## Travail en parallèle";
export const PARALLEL_RULES: readonly string[] = [
  "D'autres agents travaillent sur ce projet : la section « Travail en cours sur le projet » dit ce qu'ils ont déclaré et écrit.",
  'Avant de créer un utilitaire, cherche-le dans le code (`Grep`) et dans cette section ; `mcp__kibo__peek_work { run: "BOU-12" }` liste ce qu\'un autre run a écrit, `{ run, path }` montre un fichier de son espace.',
  "Si Kibo te signale un recouvrement, un recouvrement est une information : reprends ou factorise si c'est le même code, sinon continue. Reprendre, c'est copier sa version à l'identique au même chemin ; factoriser, c'est extraire une fonction commune dans un nouveau fichier identique des deux côtés.",
  "Si tu reprends ou factorises, dis-le dans les `decisions` de ton compte rendu (« Repris `formatDate` de BOU-12 »).",
];

const ELLIPSIS = "…";

const bounded = (text: string, max: number): string => {
  const masked = maskSecrets(text);
  return masked.length <= max ? masked : `${masked.slice(0, max - ELLIPSIS.length)}${ELLIPSIS}`;
};

const code = (text: string): string => `\`${text}\``;
const at = (path: string, line: number): string => code(`${path}:${line}`);

type Sides = { mine: string; theirs: string };

function sidesOf(detail: Exclude<OverlapDetail, { kind: "file" }>, role: OverlapRole): Sides {
  const owner = detail.kind === "block" ? at(detail.ownerPath, detail.ownerStart) : code(detail.ownerPath);
  const other = detail.kind === "block" ? at(detail.otherPath, detail.otherStart) : code(detail.otherPath);
  return role === "other" ? { mine: other, theirs: owner } : { mine: owner, theirs: other };
}

function summaryOf(detail: OverlapDetail, role: OverlapRole): string {
  if (detail.kind === "file") return `${code(detail.path)} modifié des deux côtés`;
  const { mine, theirs } = sidesOf(detail, role);
  const what =
    detail.kind === "export" ? `${code(detail.name)} exporté deux fois` : `${detail.lines} lignes identiques`;
  return `${what} (${mine}, chez lui ${theirs})`;
}

export function overlapSummary(
  detail: OverlapDetail,
  withRunName: string,
  role: OverlapRole = "other",
): string {
  return bounded(`Recouvrement avec ${withRunName} : ${summaryOf(detail, role)}`, OVERLAP_SUMMARY_MAX);
}

const INFO = "Kibo — information :";

const reuse = (ticketKey: string, path: string): string =>
  `Si c'est le même code, reprends le sien (\`mcp__kibo__peek_work { run: "${ticketKey}", path: "${path}" }\`, copie à l'identique au même chemin) ou factorise ; sinon continue. Rien à justifier.`;

function otherAlert(detail: OverlapDetail, withRunName: string, ticketKey: string): string {
  switch (detail.kind) {
    case "file":
      return `${INFO} ${code(detail.path)} est aussi modifié par ${withRunName}. ${reuse(ticketKey, detail.path)}`;
    case "export":
      return `${INFO} ${code(detail.name)} est aussi exporté par ${withRunName} (${code(detail.ownerPath)}, toi ${code(detail.otherPath)}). ${reuse(ticketKey, detail.ownerPath)}`;
    case "block":
      return `${INFO} ${detail.lines} lignes de ${at(detail.otherPath, detail.otherStart)} sont identiques à ${at(detail.ownerPath, detail.ownerStart)} chez ${withRunName}. ${reuse(ticketKey, detail.ownerPath)}`;
  }
}

function ownerAlert(detail: OverlapDetail, withRunName: string): string {
  switch (detail.kind) {
    case "file":
      return `${INFO} ${withRunName} modifie aussi ${code(detail.path)}. Rien à faire.`;
    case "export":
      return `${INFO} ${withRunName} ajoute aussi un export ${code(detail.name)} (${code(detail.otherPath)}). Rien à faire.`;
    case "block":
      return `${INFO} ${withRunName} a ${detail.lines} lignes identiques à ton code de ${at(detail.ownerPath, detail.ownerStart)} (${at(detail.otherPath, detail.otherStart)}). Rien à faire.`;
  }
}

export function overlapAlert(
  role: OverlapRole,
  detail: OverlapDetail,
  withRunName: string,
  withTicketKey: string,
): string {
  const text =
    role === "other" ? otherAlert(detail, withRunName, withTicketKey) : ownerAlert(detail, withRunName);
  return bounded(text, DUPLICATION_LIMITS.alertChars);
}

const REASON_TEXT: Record<AutoLinkReason, string> = { copy: "repris de", import: "importé de" };

export const autoLinkSummary = (
  fromKey: string,
  toKey: string,
  reason: AutoLinkReason,
  path: string,
): string =>
  bounded(
    `Kibo a lié ${fromKey} → ${toKey} (${fromKey} bloque ${toKey}) : ${code(path)} ${REASON_TEXT[reason]} ${fromKey}`,
    OVERLAP_SUMMARY_MAX,
  );

export const autoLinkFailure = (fromKey: string, toKey: string): string =>
  `Kibo n'a pas pu lier ${fromKey} → ${toKey} : dépendance circulaire`;
