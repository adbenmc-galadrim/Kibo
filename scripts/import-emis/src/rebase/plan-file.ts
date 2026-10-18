import {
  Actor,
  DeliveryKind,
  DeliveryStep,
  ExternalRef,
  ImportRef,
  KiboError,
  ProjectCommand,
  ProjectSetup,
  StatusId,
} from "@kibo/schema";
import { z } from "zod";
import { desiredCommands, type PlannedCommand, rebaseSetup } from "./desired-new";
import { type Mapping, mapProject } from "./mapping";
import type { OldProject } from "./old-project";
import { featureInputs, type IgnoredDependency, planSprints } from "./plan-sprints";
import type { TodoPlacement } from "./todo-placement";
import { type Merge, observedVelocity, type StepMerge } from "./velocity";

export type PlanSource = "getProject" | "tickets-list";
export type ScheduledFeature = { id: string; sprint: number; remaining: number };
export type RebasePlan = {
  version: 1;
  source: PlanSource;
  fingerprint: string;
  setup: ProjectSetup;
  velocity: number;
  velocitySource: string;
  merges: StepMerge[];
  schedule: ScheduledFeature[];
  ignoredDependencies: IgnoredDependency[];
  mapping: Mapping;
  commands: PlannedCommand[];
};

const OldTicket = z.object({
  id: z.string(),
  key: z.string(),
  planId: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  statusId: StatusId,
  blockedReason: z.string().nullable(),
  parentKey: z.string().nullable(),
  rank: z.number().int(),
  labels: z.array(z.string()),
  refs: z.array(ExternalRef),
  delivery: DeliveryStep.nullable(),
  optional: z.boolean(),
});
const OldQuestion = z.object({
  id: z.string(),
  ticketKey: z.string(),
  title: z.string(),
  context: z.string(),
  blocking: z.boolean(),
  importRef: ImportRef.nullable(),
  recipient: z.string().nullable(),
  createdBy: Actor,
  answer: z.object({ text: z.string(), by: Actor, at: z.number().int() }).nullable(),
  archived: z.boolean(),
});
const NewStep = z.object({
  newKey: z.string(),
  oldKey: z.string(),
  title: z.string(),
  fromTodo: z.boolean(),
  labels: z.array(z.string()),
  ticket: OldTicket,
});
const LinkType = z.enum(["blocks", "relates"]);
const MappingFile = z.object({
  project: z.object({
    name: z.string(),
    key: z.string(),
    folder: z.string().nullable(),
    color: z.string(),
    client: z.string().nullable(),
  }),
  features: z.array(
    z.object({
      shortKey: z.string(),
      chapter: z.string(),
      title: z.string(),
      oldKey: z.string(),
      labels: z.array(z.string()),
      ticket: OldTicket,
      steps: z.array(NewStep),
    }),
  ),
  keys: z.array(z.tuple([z.string(), z.string()])).transform((entries) => new Map(entries)),
  dropped: z.array(z.object({ oldKey: z.string(), why: z.string() })),
  questions: z.array(z.object({ old: OldQuestion, ticketOldKey: z.string() })),
  links: z.array(z.object({ from: z.string(), to: z.string(), type: LinkType })),
  droppedLinks: z.array(
    z.object({ fromKey: z.string(), toKey: z.string(), type: LinkType, why: z.string() }),
  ),
});
const PlannedCommandFile = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("createProject"),
    name: z.string(),
    key: z.string(),
    folder: z.string().nullable(),
    color: z.string(),
    client: z.string().nullable(),
    setup: ProjectSetup,
  }),
  z.object({
    op: z.literal("command"),
    command: ProjectCommand,
    defines: z.string().nullable(),
    expectKey: z.string().nullable(),
  }),
  z.object({
    op: z.literal("setDeliveryStep"),
    ticketKey: z.string(),
    step: z.number().int(),
    note: z.string(),
    kind: DeliveryKind,
  }),
]);
const RebasePlanFile: z.ZodType<RebasePlan, z.ZodTypeDef, unknown> = z.object({
  version: z.literal(1),
  source: z.enum(["getProject", "tickets-list"]),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  setup: ProjectSetup,
  velocity: z.number().int().positive(),
  velocitySource: z.string(),
  merges: z.array(
    z.object({ number: z.number().int(), mergedAt: z.string(), key: z.string(), week: z.string() }),
  ),
  schedule: z.array(z.object({ id: z.string(), sprint: z.number().int(), remaining: z.number().int() })),
  ignoredDependencies: z.array(z.object({ feature: z.string(), blockedBy: z.string() })),
  mapping: MappingFile,
  commands: z.array(PlannedCommandFile),
});

export function serializePlan(plan: RebasePlan): string {
  const json = JSON.stringify(plan, (_, value) => (value instanceof Map ? [...value.entries()] : value), 2);
  return `${json}\n`;
}

export function parsePlan(text: string): RebasePlan {
  const raw: unknown = JSON.parse(text);
  const version = z.object({ version: z.unknown() }).safeParse(raw);
  if (!version.success || version.data.version !== 1)
    throw new KiboError("INVALID_INPUT", "unsupported rebase plan version, expected 1");
  const parsed = RebasePlanFile.safeParse(raw);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid rebase plan: ${parsed.error.message}`);
  return parsed.data;
}

export type PlanRequest = {
  old: OldProject;
  source: PlanSource;
  merges: readonly Merge[] | null;
  placement: TodoPlacement;
  overrides: Readonly<Record<string, string>>;
};

export function buildRebasePlan(request: PlanRequest): RebasePlan {
  const mapping = mapProject(request.old, request.placement, request.overrides);
  const observed = observedVelocity(mapping, request.merges);
  const { inputs, ignored } = featureInputs(mapping);
  const scheduled = planSprints(inputs, observed.velocity);
  const remaining = new Map(inputs.map((i) => [i.id, i.remaining]));
  return {
    version: 1,
    source: request.source,
    fingerprint: request.old.fingerprint,
    setup: rebaseSetup(scheduled),
    velocity: observed.velocity,
    velocitySource: observed.source,
    merges: observed.merges,
    schedule: scheduled.map((s) => ({ ...s, remaining: remaining.get(s.id) ?? 0 })),
    ignoredDependencies: ignored,
    mapping,
    commands: desiredCommands(mapping, scheduled),
  };
}
