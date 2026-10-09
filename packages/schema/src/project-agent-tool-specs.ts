import { LABEL_MAX } from "./label";
import { MAX_NOTE_CHARS } from "./note";
import {
  ACTION_BRIEF_MAX,
  ACTION_DESCRIPTION_MAX,
  ACTION_GROUPS,
  ACTION_TITLE_MAX,
  BATCH_SUMMARY_MAX,
  WHY_MAX,
} from "./project-agent";
import { LIST_QUERY_MAX, type ProjectAgentTool } from "./project-agent-tools";
import { QUESTION_CONTEXT_MAX, QUESTION_OPTION_MAX, QUESTION_OPTIONS_MAX } from "./question";
import { RunState } from "./run";
import { StatusId } from "./status";

export type ToolSpec = { name: ProjectAgentTool; description: string; inputSchema: Record<string, unknown> };

const object = (properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "object",
  properties,
  required,
});
const text = (description: string, maxLength?: number) =>
  maxLength === undefined ? { type: "string", description } : { type: "string", description, maxLength };
const cursor = {
  type: "string",
  pattern: "^\\d+$",
  description: "Décalage de la page suivante (nextCursor).",
};
const ticketRef = { type: "string", pattern: "^([A-Z]{2,6}-\\d+|new:[1-9]\\d{0,3})$" };
const statusId = { type: "string", enum: StatusId.options };
const labels = { type: "array", items: { type: "string" }, maxItems: LABEL_MAX };
const option = { type: "string", maxLength: QUESTION_OPTION_MAX };

const ACTION = object(
  {
    id: { type: "integer", minimum: 1, description: "Rang de l'action dans le lot." },
    type: { type: "string", enum: Object.keys(ACTION_GROUPS) },
    why: text("Pourquoi, en une ligne.", WHY_MAX),
    ref: { type: "string", pattern: "^new:[1-9]\\d{0,3}$", description: "createTicket : référence new:<n>." },
    ticket: { ...ticketRef, description: "Clé du ticket ou new:<n> d'un createTicket antérieur." },
    from: ticketRef,
    to: ticketRef,
    kind: { type: "string", enum: ["blocks", "relates"] },
    title: text("Titre du ticket ou de la question.", ACTION_TITLE_MAX),
    description: text("Description du ticket, en Markdown.", ACTION_DESCRIPTION_MAX),
    statusId,
    blockedReason: { type: "string" },
    labels,
    parent: { ...ticketRef, description: "Ticket parent." },
    profileId: { type: "string", description: "Profil assignable (list_profiles)." },
    brief: text("Consigne pour l'agent.", ACTION_BRIEF_MAX),
    fresh: { type: "boolean" },
    runId: { type: "string" },
    questionId: { type: "string" },
    answer: object(
      {
        kind: { type: "string", enum: ["confirm", "option", "text"] },
        option,
        text: { type: "string" },
      },
      ["kind"],
    ),
    context: text("Contexte de la question, en Markdown.", QUESTION_CONTEXT_MAX),
    options: { type: "array", items: option, maxItems: QUESTION_OPTIONS_MAX },
    provisional: option,
    blocking: { type: "boolean" },
    path: text("Chemin de la note, en .md."),
    content: text("Contenu complet de la note.", MAX_NOTE_CHARS),
  },
  ["id", "type", "why"],
);

export const TOOL_SPECS: readonly ToolSpec[] = [
  {
    name: "project_overview",
    description:
      "Instantané du projet : statuts, tickets actifs, runs et file, questions ouvertes, notes, profils et note mémoire.",
    inputSchema: object(),
  },
  {
    name: "list_tickets",
    description: "Liste les tickets du projet, filtrés par statut, étiquette ou texte, 50 par page.",
    inputSchema: object({
      status: statusId,
      label: { type: "string" },
      query: text("Texte cherché dans la clé ou le titre.", LIST_QUERY_MAX),
      cursor,
    }),
  },
  {
    name: "get_ticket",
    description: "Fiche complète d'un ticket : description, liens, branche, PR, questions, runs.",
    inputSchema: object({ key: { type: "string", pattern: "^[A-Z]{2,6}-\\d+$" } }, ["key"]),
  },
  {
    name: "list_questions",
    description: "Questions du projet, ouvertes par défaut, éventuellement d'un seul ticket.",
    inputSchema: object({
      state: { type: "string", enum: ["open", "answered", "all"] },
      ticketKey: { type: "string", pattern: "^[A-Z]{2,6}-\\d+$" },
    }),
  },
  {
    name: "list_runs",
    description: "Runs d'agents du projet, file d'attente comprise.",
    inputSchema: object({ state: { type: "string", enum: RunState.options } }),
  },
  {
    name: "list_notes",
    description: "Notes du projet, 50 par page.",
    inputSchema: object({ cursor }),
  },
  {
    name: "read_note",
    description: "Contenu Markdown d'une note du projet.",
    inputSchema: object({ path: text("Chemin de la note, en .md.", 512) }, ["path"]),
  },
  {
    name: "list_profiles",
    description: "Profils d'agents assignables à un ticket du projet.",
    inputSchema: object(),
  },
  {
    name: "project_changes",
    description: "Ce qui a changé dans le projet depuis ton dernier tour.",
    inputSchema: object(),
  },
  {
    name: "propose_batch",
    description:
      "Propose un lot d'actions à faire valider par l'utilisateur. Seul moyen de modifier le projet ; une proposition par tour au plus.",
    inputSchema: object(
      {
        summary: text("Résumé du lot, en français.", BATCH_SUMMARY_MAX),
        actions: { type: "array", items: ACTION, minItems: 1 },
      },
      ["summary", "actions"],
    ),
  },
];
