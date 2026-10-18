import { sprintPlan } from "@kibo/schema";
import { isPlaced, type Mapping, type NewFeature } from "./mapping";
import type { RebasePlan } from "./plan-file";

const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
const KNOWN_RECIPIENTS = ["me", "product", "client"];

const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
const row = (cells: readonly string[]): string => `| ${cells.map(cell).join(" | ")} |`;
const table = (head: readonly string[], body: readonly string[][]): string[] => [
  row(head),
  row(head.map(() => "---")),
  ...body.map(row),
];

function dayLabel(date: string, withYear: boolean): string {
  const [year = "", month = "1", day = "1"] = date.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ""}${withYear ? ` ${year}` : ""}`;
}

export function rangeLabel(start: string, end: string): string {
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8))} → ${dayLabel(end, true)}`;
  return `${dayLabel(start, start.slice(0, 4) !== end.slice(0, 4))} → ${dayLabel(end, true)}`;
}

const featureLabel = (f: NewFeature): string => `${f.shortKey} · ${f.title}`;

function contexts(plan: RebasePlan) {
  const sprintOf = new Map(plan.schedule.map((s) => [s.id, s.sprint]));
  const byChapter = new Map(plan.mapping.features.map((f) => [f.chapter, f]));
  const byOldKey = new Map(
    plan.mapping.features.flatMap((f) => [
      [f.oldKey, f],
      ...f.steps.map((s): [string, NewFeature] => [s.oldKey, f]),
    ]),
  );
  const sprintLabel = (f: NewFeature | undefined): string => {
    const sprint = f ? sprintOf.get(f.shortKey) : undefined;
    return sprint === undefined ? "livrée" : `S${sprint}`;
  };
  return { byChapter, byOldKey, sprintLabel };
}

export function pointsToPlace(plan: RebasePlan): string[] {
  const m = plan.mapping;
  const lines = [
    ...(plan.source === "tickets-list"
      ? [
          "Source `tickets-list.json` : ni descriptions, ni questions, ni liens `relates` ; plan à refaire depuis `getProject` avant `--apply`.",
        ]
      : []),
    ...m.dropped.filter((d) => d.why.startsWith("à placer")).map((d) => `${d.oldKey} : ${d.why}.`),
    ...m.questions
      .filter((q) => !isPlaced(q))
      .map(
        (q) =>
          `Question ${q.old.importRef?.id ?? q.old.id} « ${q.old.title} » sans cible : la nommer dans question-placement.ts.`,
      ),
    ...plan.ignoredDependencies.map(
      (d) =>
        `Dépendance ignorée pour casser un cycle : ${d.feature} attendait ${d.blockedBy} (ordre du plan retenu).`,
    ),
    ...m.questions
      .filter((q) => q.old.recipient !== null && !KNOWN_RECIPIENTS.includes(q.old.recipient))
      .map(
        (q) => `Question ${q.old.importRef?.id ?? q.old.id} : destinataire « ${q.old.recipient} » à recréer.`,
      ),
  ];
  return lines;
}

function toPlace(plan: RebasePlan): string[] {
  const lines = pointsToPlace(plan);
  return lines.length > 0 ? lines.map((l) => `- ${l}`) : ["Rien à placer."];
}

const keyNumber = (key: string): number => Number(key.split("-").at(-1));
const todoIdOf = (refs: readonly { kind: string; source?: string; id?: string }[]): string =>
  refs.find((r) => r.kind === "import_ref" && r.source === "todo")?.id ?? "?";

function todoSection(plan: RebasePlan): string[] {
  const m = plan.mapping;
  const { byOldKey } = contexts(plan);
  const steps = m.features.flatMap((f) =>
    f.steps
      .filter((s) => s.fromTodo)
      .map((s) => [todoIdOf(s.ticket.refs), s.oldKey, `étape ${s.newKey}`, featureLabel(f)]),
  );
  const questions = m.questions
    .filter((q) => q.old.importRef?.source === "todo")
    .map((q) => {
      const f = byOldKey.get(q.ticketOldKey);
      return [q.old.importRef?.id ?? "?", q.old.ticketKey, "question au client", f ? featureLabel(f) : "—"];
    });
  const missing = m.dropped
    .filter((d) => d.why.startsWith("à placer"))
    .map((d) => [d.why.match(/^à placer : (\S+)/)?.[1] ?? "?", d.oldKey, "à placer", "—"]);
  const body = [...steps, ...questions, ...missing].sort(
    (x, y) => keyNumber(x[1] ?? "") - keyNumber(y[1] ?? ""),
  );
  return table(["TODO", "Ancienne clé", "Devient", "Fonctionnalité"], body);
}

function keysSection(plan: RebasePlan): string[] {
  const { byChapter, sprintLabel } = contexts(plan);
  const body: string[][] = [];
  for (const f of plan.mapping.features) {
    body.push([f.oldKey, f.shortKey, featureLabel(f), sprintLabel(f)]);
    for (const s of f.steps) body.push([s.oldKey, s.newKey, featureLabel(f), sprintLabel(f)]);
  }
  for (const q of plan.mapping.questions.filter((x) => x.old.importRef?.source === "todo")) {
    const f = [...byChapter.values()].find((x) => x.oldKey === q.ticketOldKey);
    body.push([
      q.old.ticketKey,
      `question (${f?.shortKey ?? "?"})`,
      f ? featureLabel(f) : "—",
      sprintLabel(f),
    ]);
  }
  return table(["Ancienne clé", "Nouvelle clé", "Fonctionnalité", "Sprint"], body);
}

function questionsSection(m: Mapping): string[] {
  const body = m.questions.map((q) => {
    const target = isPlaced(q) ? `${m.keys.get(q.ticketOldKey) ?? "?"} (ex ${q.ticketOldKey})` : "à placer";
    return [
      q.old.importRef?.id ?? "—",
      q.old.title,
      target,
      q.old.blocking ? "bloquante" : "non",
      q.old.answer ? `répondue : ${q.old.answer.text}` : "ouverte",
    ];
  });
  return table(["Question", "Titre", "Ticket cible", "Bloquante", "Réponse"], body);
}

function droppedSections(m: Mapping): string[] {
  return [
    "## Liens tombés",
    "",
    ...table(
      ["De", "Vers", "Type", "Raison"],
      m.droppedLinks.map((l) => [l.fromKey, l.toKey, l.type, l.why]),
    ),
    "",
    "## Tickets non recréés",
    "",
    ...m.dropped.map((d) => `- ${d.oldKey} : ${d.why}.`),
    "- Non transférés (présents dans la sauvegarde) : historique de l'agent de projet, journal `project_events`, historique d'édition des questions.",
  ];
}

function velocitySection(plan: RebasePlan): string[] {
  const merges = plan.merges.map((x) => [`#${x.number}`, x.mergedAt.slice(0, 10), x.week, x.key]);
  return [
    "## Vitesse",
    "",
    `Vitesse observée : ${plan.velocity} étapes par semaine (${plan.velocitySource}).`,
    "",
    ...(merges.length > 0
      ? table(["PR", "Fusionnée le", "Semaine", "Étape"], merges)
      : ["Aucune fusion retenue."]),
  ];
}

function sprintsSection(plan: RebasePlan): string[] {
  const { byOldKey } = contexts(plan);
  const features = new Map([...byOldKey.values()].map((f) => [f.shortKey, f]));
  const sprints = sprintPlan(plan.setup);
  const total = plan.schedule.reduce((n, s) => n + s.remaining, 0);
  const body = sprints.map((s, i) => {
    const placed = plan.schedule.filter((x) => x.sprint === i + 1).map((x) => features.get(x.id));
    const names = placed.map((f) => (f ? featureLabel(f) : "?")).join(", ");
    const load = Math.max(0, Math.min(plan.velocity, total - i * plan.velocity));
    return [s.code, rangeLabel(s.start, s.end), names || "—", String(load)];
  });
  const delivered = plan.mapping.features.filter((f) => !plan.schedule.some((s) => s.id === f.shortKey));
  const last = sprints.at(-1);
  return [
    "## Plan de sprints",
    "",
    `Sprints d'une semaine à partir du lundi ${plan.setup.sprintStart}, ${plan.velocity} étapes par sprint, ordre des dépendances puis du plan.`,
    "",
    ...table(["Sprint", "Dates", "Fonctionnalités", "Étapes"], body),
    "",
    `Fin prévue : ${last ? dayLabel(last.end, true) : "—"} (${plan.setup.sprintCount} sprints, ${total} étapes restantes).`,
    ...(delivered.length > 0
      ? [`Déjà livrées, sans sprint : ${delivered.map(featureLabel).join(", ")}.`]
      : []),
  ];
}

function countsSection(plan: RebasePlan): string[] {
  const m = plan.mapping;
  const steps = m.features.flatMap((f) => f.steps);
  const questions = m.questions.filter(isPlaced);
  const last = m.features.at(-1)?.shortKey ?? "F0";
  return [
    "## Comptes attendus",
    "",
    `- Fonctionnalités : ${m.features.length} (F1 à ${last})`,
    `- Étapes : ${steps.length} (${steps[0]?.newKey ?? "—"} à ${steps.at(-1)?.newKey ?? "—"}, dont ${steps.filter((s) => s.fromTodo).length} venues de TODO)`,
    `- Questions : ${questions.length} (dont ${questions.filter((q) => q.old.recipient === "client").length} au client)`,
    `- Liens : ${m.links.length} (${m.droppedLinks.length} tombés)`,
    `- Sprints : ${plan.setup.sprintCount}`,
    `- Commandes : ${plan.commands.length}`,
  ];
}

export function renderReport(plan: RebasePlan): string {
  return [
    `# Rebase de ${plan.mapping.project.name} : plan (dry-run)`,
    "",
    `Source : ${plan.source} · empreinte de l'ancien projet \`${plan.fingerprint}\`. Rien n'est écrit tant que \`--apply\` n'a pas relu ce plan.`,
    "",
    "## À placer",
    "",
    ...toPlace(plan),
    "",
    "## Placement de TODO",
    "",
    ...todoSection(plan),
    "",
    "## Correspondance des clés",
    "",
    ...keysSection(plan),
    "",
    "## Questions",
    "",
    ...questionsSection(plan.mapping),
    "",
    ...droppedSections(plan.mapping),
    "",
    ...velocitySection(plan),
    "",
    ...sprintsSection(plan),
    "",
    ...countsSection(plan),
    "",
  ].join("\n");
}
