import {
  type Actor,
  type ExternalRef,
  type Link,
  type ProjectCommand,
  ProjectMeta,
  Question,
  StatusId,
  Ticket,
} from "@kibo/schema";
import { z } from "zod";
import type { SeedClient } from "../src/daemon-client";

export type EmisShapedSnapshot = {
  meta: ProjectMeta;
  tickets: Ticket[];
  links: Link[];
  questions: Question[];
};

type Spec = {
  ref: string;
  parent: string | null;
  title: string;
  importRef: ExternalRef | null;
  labels: string[];
};

const REPO = "https://github.com/example/emis-fictif";
const AT = Date.UTC(2026, 9, 1, 9, 0, 0);
const IMPORT: Actor = { kind: "import", ref: "plan" };
const ADAM: Actor = { kind: "human", ref: "adam" };
const META = ProjectMeta.parse({
  id: "emis-shaped",
  key: "EMIS",
  name: "Emis",
  folder: null,
  color: "#F97316",
});

const words = (text: string): string[] => text.split(" ").filter((w) => w.length > 0);
const pairs = (text: string, separator = " "): [string, string][] =>
  text.split(separator).map((w) => {
    const [a = "", b = ""] = w.split(">");
    return [a, b];
  });

const CHAPTERS = pairs(
  "C0>Socle C1>Accès C2>Modèle C3>Dossiers C4>Import C5>Segments C6>Badges C7>Tableau " +
    "C8>Mouvements C9>Terrain CR>Rapports CN>Alertes CP>Partage CE>Équipe CL>Lancement",
);
const STEP_COUNT: Record<string, number> = { C1: 4 };
const LOOSE: Record<string, string> = {
  C0: "Nettoyer les données de test",
  C1: "Revoir les messages d'erreur",
};
const TODO_ITEMS = pairs(
  "DATA-1>Liste fictive des sites à confirmer|DATA-2>Colonnes fictives à demander|" +
    "PLAN-1>Trous relevés dans le modèle|DEV-1>Conflit de ports en local|DEV-2>Menu visible de tous les rôles|" +
    "DEV-3>Première table synchronisée|DEV-4>Base de test partagée|RFID-1>Valider le code des badges|" +
    "RFID-2>Renuméroter une migration",
  "|",
);
const DONE = words("C0-1 C0-2 C0-3 C0-4 C1-1 C1-2 C2-1 C2-2 C2-3 C6-1 C6-2");
const STATUS = Object.fromEntries(pairs("C1-3>in_review C2-4>in_progress C2-5>in_review C3-1>in_progress"));
const BLOCKED = Object.fromEntries(
  pairs(
    "C0-5>Bloquée : attend le compte d'hébergement.|C6-4>Bloquée : décision non actée (Q5).|" +
      "CN-2>Bloquée : seuils promis, non reçus (Q7).|CP-2>Bloquée : maquettes contradictoires.",
    "|",
  ),
);
const MERGED = words("C0-2 C0-3 C0-4 C1-1 C1-2 C2-1 C2-2 C2-3 C6-1 C6-2");
const PR_STATES: Record<string, "open" | "draft"> = { "C1-3": "open", "C2-5": "open", "C2-4": "draft" };
const PR_ORDER = [...MERGED, ...Object.keys(PR_STATES)];
const BRANCH_ONLY = words("C3-1 C0-5");
const LINKS = pairs(
  "C0-2>C0-3 C2-5>C3-1 C3-2>C5-1 C5-3>C7-1 C0-5>CL-1 C6-3>C9-2 C2>C3 arbitrages>C6-4 DEV-3>C9-1 DATA-1>C3-3",
);
const RELATES = pairs("C4-1>C3-3");
const QUESTIONS: readonly [string, string, string, string, string | null][] = [
  ["Q5", "arbitrages", "Architecture des badges validée ?", "Budget à acter.", null],
  ["Q7", "arbitrages", "Seuils d'alerte ?", "Promis par le client.", null],
  ["Q9", "arbitrages", "Périmètre du tableau", "Concerne C2-5 et le tableau.", "Oui, inclus."],
  ["Q11", "C3-2", "Numérotation des dossiers ?", "Format libre.", "Annuelle."],
];

const importRef = (source: string, id: string): ExternalRef => ({ kind: "import_ref", source, id });
const stepLabels = (i: number): string[] => [
  `area:${["api", "web", "db"][i % 3]}`,
  "phase:p1",
  `sprint:s${i % 4}`,
];

function chapterSpecs(chapter: string, name: string): Spec[] {
  const count = STEP_COUNT[chapter] ?? 5;
  const out: Spec[] = [
    {
      ref: chapter,
      parent: null,
      title: `${chapter} · ${name}`,
      importRef: importRef("plan", chapter),
      labels: [],
    },
  ];
  for (let i = 1; i <= count; i += 1) {
    const id = `${chapter}-${i}`;
    out.push({
      ref: id,
      parent: chapter,
      title: `${id} · Étape ${i} ${name}`,
      importRef: importRef("plan", id),
      labels: stepLabels(i),
    });
    const loose = LOOSE[chapter];
    if (i === count - 1 && loose)
      out.push({
        ref: `${chapter}-x`,
        parent: chapter,
        title: loose,
        importRef: null,
        labels: stepLabels(i),
      });
  }
  return out;
}

function specs(): Spec[] {
  const todo = TODO_ITEMS.map(([id, title]) => ({
    ref: id,
    parent: "todo",
    title: `${id} · ${title}`,
    importRef: importRef("todo", id),
    labels: id.startsWith("DATA") ? ["decision:pending", "priority:p0"] : ["priority:unsorted"],
  }));
  return [
    ...CHAPTERS.flatMap(([chapter, name]) => chapterSpecs(chapter, name)),
    {
      ref: "arbitrages",
      parent: null,
      title: "Arbitrages",
      importRef: importRef("plan", "arbitrages"),
      labels: [],
    },
    { ref: "todo", parent: null, title: "TODO", importRef: importRef("plan", "todo"), labels: [] },
    ...todo,
  ];
}

function refsOf(spec: Spec): ExternalRef[] {
  const refs: ExternalRef[] = spec.importRef ? [spec.importRef] : [];
  const index = PR_ORDER.indexOf(spec.ref);
  const head = `feat/${spec.ref.toLowerCase()}`;
  if (index >= 0 || BRANCH_ONLY.includes(spec.ref))
    refs.push({ kind: "git_branch", branch: head, base: "dev" });
  if (index < 0) return refs;
  const number = index + 1;
  const state = PR_STATES[spec.ref] ?? "merged";
  refs.push({
    kind: "github_pr",
    url: `${REPO}/pull/${number}`,
    number,
    state,
    base: "dev",
    head,
    review: "none",
    checks: null,
  });
  return refs;
}

const statusOf = (ref: string): StatusId =>
  DONE.includes(ref) ? "done" : BLOCKED[ref] ? "blocked" : StatusId.parse(STATUS[ref] ?? "todo");

function ticketOf(spec: Spec, index: number, ids: ReadonlyMap<string, string>): Ticket {
  const statusId = statusOf(spec.ref);
  return Ticket.parse({
    id: `t${index + 1}`,
    key: `EMIS-${index + 1}`,
    pendingSeq: null,
    title: spec.title,
    description: `Description fictive de ${spec.ref}.`,
    statusId,
    blockedReason: statusId === "blocked" ? (BLOCKED[spec.ref] ?? null) : null,
    domainId: null,
    assignee: spec.ref === "C2-4" ? { kind: "agent", ref: "livraison" } : null,
    parentId: spec.parent === null ? null : (ids.get(spec.parent) ?? null),
    externalRefs: refsOf(spec),
    labels: spec.labels,
    delivery: spec.ref === "C2-4" ? { step: 6, note: "Code en cours", at: AT, runId: null } : null,
    optional: spec.ref === "C7-5",
  });
}

function questionOf(
  spec: (typeof QUESTIONS)[number],
  index: number,
  ids: ReadonlyMap<string, string>,
): Question {
  const [id, on, title, context, text] = spec;
  const answer = text === null ? null : { kind: "text", option: null, text, by: ADAM, at: AT };
  return Question.parse({
    id: `q${index + 1}`,
    ticketId: ids.get(on) ?? "",
    runId: null,
    title,
    context,
    options: [],
    provisional: null,
    blocking: on === "arbitrages",
    createdBy: IMPORT,
    createdAt: AT,
    importRef: importRef("plan", id),
    answer,
  });
}

export function emisShapedSnapshot(): EmisShapedSnapshot {
  const all = specs();
  const ids = new Map(all.map((s, i) => [s.ref, `t${i + 1}`]));
  const link = ([from, to]: [string, string], type: Link["type"]) => ({
    from: ids.get(from) ?? "",
    to: ids.get(to) ?? "",
    type,
  });
  const links = [...LINKS.map((p) => link(p, "blocks")), ...RELATES.map((p) => link(p, "relates"))];
  return {
    meta: META,
    tickets: all.map((s, i) => ticketOf(s, i, ids)),
    links: links.map((l, i) => ({ id: `l${i + 1}`, ...l })),
    questions: QUESTIONS.map((q, i) => questionOf(q, i, ids)),
  };
}

const Created = z.object({ id: z.string().min(1) });

export async function seedEmisShaped(client: SeedClient): Promise<{ projectId: string }> {
  const snapshot = emisShapedSnapshot();
  const { id: projectId } = await client.rpc({
    method: "createProject",
    name: META.name,
    key: META.key,
    folder: null,
    color: META.color,
  });
  const send = async (command: ProjectCommand) => client.rpc({ method: "command", projectId, command });
  const ids = new Map<string, string>();
  const real = (id: string) => ids.get(id) ?? id;
  for (const t of snapshot.tickets) {
    const { title, description, labels, assignee } = t;
    const parentId = t.parentId === null ? null : real(t.parentId);
    ids.set(
      t.id,
      Created.parse(await send({ method: "createTicket", title, description, labels, parentId, assignee }))
        .id,
    );
  }
  for (const t of snapshot.tickets) {
    const ticketId = real(t.id);
    const reason = t.blockedReason ? { reason: t.blockedReason } : {};
    if (t.statusId !== "todo") await send({ method: "setStatus", ticketId, statusId: t.statusId, ...reason });
    for (const ref of t.externalRefs) await send({ method: "upsertExternalRef", ticketId, ref });
    if (t.optional) await send({ method: "setTicketOptional", ticketId, optional: true });
    const { delivery, key } = t;
    if (delivery && key)
      await client.rpc({
        method: "setDeliveryStep",
        projectId,
        ticketKey: key,
        step: delivery.step,
        note: delivery.note,
      });
  }
  for (const l of snapshot.links)
    await send({ method: "addLink", from: real(l.from), to: real(l.to), type: l.type });
  for (const q of snapshot.questions) {
    const { title, context, blocking, createdBy, importRef: ref } = q;
    const created = await send({
      method: "createQuestion",
      ticketId: real(q.ticketId),
      title,
      context,
      blocking,
      createdBy,
      importRef: ref,
    });
    const answer = q.answer;
    if (answer)
      await send({
        method: "answerQuestion",
        questionId: Created.parse(created).id,
        answer: { kind: "text", text: answer.text },
        by: answer.by,
        at: answer.at,
      });
  }
  return { projectId };
}
