import type { KiboError } from "@kibo/schema";
import { PLAN_FILE_ERRORS } from "./fr-plan";

export type FrError = { code?: KiboError["code"]; match: RegExp; text: (m: RegExpMatchArray) => string };

const ARCHIVED = "Cette question est archivée : rouvrez-la d'abord.";

export const FR_ERRORS: readonly FrError[] = [
  {
    match: /^a step inherits the sprint of its feature: set it on (\S+)$/,
    text: (m) => `Le sprint d'une étape vient de sa fonctionnalité : posez-le sur ${m[1]}.`,
  },
  {
    match: /^a feature is a root ticket$/,
    text: () => "Une fonctionnalité est un ticket racine : elle ne se déplace pas sous un autre ticket.",
  },
  { match: /^link already exists$/, text: () => "Ce lien existe déjà." },
  { code: "LINK_CYCLE", match: /^/, text: () => "Cette dépendance créerait un cycle." },
  { match: /^a ticket cannot link to itself$/, text: () => "Un ticket ne peut pas dépendre de lui-même." },
  {
    code: "BLOCKED_REASON_REQUIRED",
    match: /^/,
    text: () => "Le statut bloqué demande une raison (reason=…).",
  },
  {
    match: /^a hold needs a step \(a feature cannot be held\)$/,
    text: () => "Une attente se pose sur une étape, pas sur une fonctionnalité.",
  },
  { match: /^an optional step needs a parent ticket$/, text: () => "Seule une étape peut être facultative." },
  {
    code: "CONFLICT",
    match: /^sprint code (.+) is already taken$/,
    text: (m) => `Le code ${m[1]} est déjà pris par un autre sprint.`,
  },
  { match: /end before start/, text: () => "La fin du sprint précède son début." },
  { match: /^question \S+ is archived/, text: () => ARCHIVED },
  {
    match: /provisional choice is not an option$/,
    text: () => "Le choix provisoire doit être une des options.",
  },
  { code: "NOT_FOUND", match: /^file not found: (.+)$/, text: (m) => `Fichier introuvable : ${m[1]}` },
  {
    match: /^(\S+) is a step of (\S+): give the feature$/,
    text: (m) => `${m[1]} est une étape de ${m[2]} : donnez la fonctionnalité.`,
  },
  ...PLAN_FILE_ERRORS,
];
