import {
  type FeatureState,
  featureLabel,
  featureState,
  featureSteps,
  type ProjectSnapshot,
  type SprintView,
  sortSprints,
  type TicketView,
} from "@kibo/schema";
import { frPlan } from "../fr-plan";

const md = frPlan.markdown;

type Plan = { snapshot: ProjectSnapshot; byId: ReadonlyMap<string, TicketView> };

function box(t: TicketView): string {
  if (t.statusId === "done") return "[x]";
  if (t.onHold !== null) return "[⏸]";
  return t.statusId === "in_progress" || t.statusId === "in_review" ? "[~]" : "[ ]";
}

const statusLabel = (snapshot: ProjectSnapshot, t: TicketView): string =>
  snapshot.workflow.find((s) => s.id === t.statusId)?.label ?? t.statusId;

function ticketLine(snapshot: ProjectSnapshot, t: TicketView): string {
  const extras = [
    ...(t.waitingOn.length > 0 ? [md.waiting(t.waitingOn)] : []),
    ...(t.optional ? [md.optional] : []),
    ...(t.onHold === null ? [] : [md.onHold(t.onHold.reason)]),
    ...(t.openQuestions > 0 ? [md.questions(t.openQuestions)] : []),
  ];
  return [`- ${box(t)} ${t.keyLabel} ${t.title} — ${statusLabel(snapshot, t)}`, ...extras].join(" · ");
}

function stepsOf(plan: Plan, feature: TicketView): TicketView[] {
  const { tickets, links } = plan.snapshot;
  return featureSteps({ feature: feature.id, tickets, links }).flatMap(
    (s) => plan.byId.get(s.ticketId) ?? [],
  );
}

function stateOf(plan: Plan, feature: TicketView): FeatureState {
  if (feature.feature !== null) return feature.feature;
  const { tickets, links } = plan.snapshot;
  const steps = featureSteps({ feature: feature.id, tickets, links });
  return featureState({ steps, blockingQuestions: new Set(), sprint: null, today: "" });
}

function featureBlock(plan: Plan, feature: TicketView): string[] {
  const state = stateOf(plan, feature);
  const { mandatoryDone, mandatoryTotal } = state.steps;
  const label = featureLabel(feature) || feature.keyLabel;
  const heading = `### ${label} · ${feature.title} — ${md.featureStatus[state.status]} (${mandatoryDone}/${mandatoryTotal})`;
  return [heading, "", ...stepsOf(plan, feature).map((t) => ticketLine(plan.snapshot, t)), ""];
}

const section = (title: string, body: readonly string[]): string[] =>
  body.length === 0 ? [] : [`## ${title}`, "", ...body];

const sprintTitle = (s: SprintView): string =>
  `${s.code} · ${s.name} (${s.start} → ${s.end}, ${md.sprintState[s.state]})`;

export function planMarkdown(snapshot: ProjectSnapshot): string {
  const parents = new Set(snapshot.tickets.flatMap((t) => (t.parentId === null ? [] : [t.parentId])));
  const plan: Plan = { snapshot, byId: new Map(snapshot.tickets.map((t) => [t.id, t])) };
  const roots = snapshot.tickets.filter((t) => t.parentId === null);
  const features = roots.filter((t) => parents.has(t.id));
  const known = new Set(snapshot.sprints.map((s) => s.id));
  const featuresIn = (sprintId: string | null) =>
    features
      .filter((f) => (f.sprintId !== null && known.has(f.sprintId) ? f.sprintId : null) === sprintId)
      .flatMap((f) => featureBlock(plan, f));
  const lone = roots.filter((t) => !parents.has(t.id)).map((t) => ticketLine(snapshot, t));
  const lines = [
    `# ${snapshot.meta.key} · ${snapshot.meta.name}`,
    "",
    ...sortSprints(snapshot.sprints).flatMap((s) => section(sprintTitle(s), featuresIn(s.id))),
    ...section(md.unplanned, featuresIn(null)),
    ...section(md.lone, lone.length === 0 ? [] : [...lone, ""]),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}
