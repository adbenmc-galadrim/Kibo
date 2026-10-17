import {
  type ExternalRef,
  INBOX_ID,
  type ProjectCommand,
  type RpcRequest,
} from "../packages/schema/src/index";
import {
  EMIS_BASE_BRANCH,
  EMIS_FEATURE_LINKS,
  EMIS_FEATURES,
  EMIS_LAST_TICKET,
  EMIS_LOOSE_TICKETS,
  EMIS_PAGES,
  EMIS_PROJECT,
  EMIS_QUESTIONS,
  EMIS_RECENT_DELIVERIES,
  EMIS_ROOT_ORDER,
  EMIS_SPRINTS,
  EMIS_STEP_LINKS,
  EMIS_WORKSPACE_NAME,
  emisKey,
  emisSteps,
  emisUsedTickets,
  INBOX_TITLES,
  OTHER_PROJECTS,
  type ProjectSpec,
  prUrl,
  type SprintCode,
  type StepSpec,
} from "./fixtures/emis-maquettes";
import { EMIS_CLOSING, EMIS_DESCRIPTION, EMIS_SESSIONS } from "./fixtures/emis-suivi";
import { seedEmisAgent } from "./seed-emis-agent";
import { type JournalWait, verifyEmisJournal, waitForMerge } from "./seed-emis-journal";

const DELIVERY_GAP_MS = 2;

const distinctInstant = () => new Promise((resolve) => setTimeout(resolve, DELIVERY_GAP_MS));

export type SeedRpc = (req: RpcRequest) => Promise<unknown>;
export type SeedOptions = {
  folder: string | null;
  mergePr(number: number): void | Promise<void>;
  wait?: JournalWait;
};
export type SeedResult = { projectId: string; seeded: boolean };

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

function textOf(value: unknown, key: string): string {
  const found = field(value, key);
  if (typeof found !== "string") throw new Error(`${key} is not a string in ${JSON.stringify(value)}`);
  return found;
}

function listOf(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error(`expected a list, got ${JSON.stringify(value)}`);
  return value;
}

async function findProject(rpc: SeedRpc, key: string): Promise<string | null> {
  const projects = listOf(await rpc({ method: "listProjects" }));
  const found = projects.find((p) => field(p, "key") === key);
  return found === undefined ? null : textOf(found, "id");
}

async function ensureProject(rpc: SeedRpc, spec: ProjectSpec, folder: string | null): Promise<string | null> {
  if ((await findProject(rpc, spec.key)) !== null) return null;
  const created = await rpc({ method: "createProject", ...spec, folder });
  return textOf(created, "id");
}

type Emis = {
  command(cmd: ProjectCommand): Promise<unknown>;
  id(n: number): string;
  user: string;
  projectId: string;
};

type DeliveredStep = StepSpec & { delivery: number };

const isDelivered = (s: StepSpec): s is DeliveredStep => s.delivery !== undefined;

function deliveryOrder(steps: readonly StepSpec[]): DeliveredStep[] {
  const delivered = steps.filter(isDelivered);
  const rank = (s: StepSpec) => EMIS_RECENT_DELIVERIES.indexOf(s.n);
  return [
    ...delivered.filter((s) => rank(s) < 0),
    ...delivered.filter((s) => rank(s) >= 0).sort((a, b) => rank(a) - rank(b)),
  ];
}

const mergedByPoller = (step: StepSpec | undefined): boolean => step?.pr?.number === EMIS_CLOSING.merged;

const stepSpecs = (): Map<number, StepSpec> =>
  new Map([...emisSteps(), ...EMIS_LOOSE_TICKETS].map((s) => [s.n, s]));

async function createTickets(emis: Emis, ids: Map<number, string>): Promise<void> {
  const steps = stepSpecs();
  const roots = new Map(EMIS_FEATURES.map((f) => [f.n, f]));
  for (let n = 1; n <= EMIS_LAST_TICKET; n += 1) {
    const step = steps.get(n);
    const root = roots.get(n);
    const created = await emis.command({
      method: "createTicket",
      title: step?.title ?? root?.title ?? `Brouillon ${n}`,
      statusId: mergedByPoller(step) ? "in_review" : (step?.status ?? "todo"),
      ...(root?.result === undefined ? {} : { description: root.result }),
      ...(step?.mine ? { assignee: { kind: "human", ref: emis.user } } : {}),
    });
    ids.set(n, textOf(created, "id"));
  }
  const used = emisUsedTickets();
  for (let n = 1; n <= EMIS_LAST_TICKET; n += 1) {
    if (!used.has(n)) await emis.command({ method: "deleteTicket", ticketId: emis.id(n) });
  }
}

async function shapeFeatures(emis: Emis): Promise<void> {
  for (const f of EMIS_FEATURES) {
    for (const step of f.steps)
      await emis.command({ method: "moveTicket", ticketId: emis.id(step.n), parentId: emis.id(f.n) });
  }
  for (const [index, n] of EMIS_ROOT_ORDER.entries())
    await emis.command({ method: "moveTicket", ticketId: emis.id(n), parentId: null, index });
  for (const step of emisSteps().filter((s) => s.optional === true))
    await emis.command({ method: "setTicketOptional", ticketId: emis.id(step.n), optional: true });
  for (const f of EMIS_FEATURES.filter((x) => x.steps.every((s) => s.status === "done")))
    await emis.command({ method: "setStatus", ticketId: emis.id(f.n), statusId: "done" });
}

async function planSprints(emis: Emis): Promise<void> {
  const sprints = new Map<SprintCode, string>();
  for (const s of EMIS_SPRINTS) {
    const created = await emis.command({ method: "createSprint", ...s });
    sprints.set(s.code, textOf(created, "id"));
  }
  const planned = [...EMIS_FEATURES, ...EMIS_LOOSE_TICKETS].flatMap((t) => {
    const sprintId = t.sprint === null ? undefined : sprints.get(t.sprint);
    return sprintId === undefined ? [] : [{ n: t.n, sprintId }];
  });
  for (const { n, sprintId } of planned)
    await emis.command({ method: "setTicketSprint", ticketId: emis.id(n), sprintId });
}

async function linkTickets(emis: Emis): Promise<void> {
  const rootOf = (shortKey: string): number => {
    const found = EMIS_FEATURES.find((f) => f.shortKey === shortKey);
    if (found === undefined) throw new Error(`feature ${shortKey} is unknown`);
    return found.n;
  };
  const featureLinks = EMIS_FEATURE_LINKS.map(([from, to]): [number, number] => [rootOf(from), rootOf(to)]);
  for (const [from, to] of [...EMIS_STEP_LINKS, ...featureLinks])
    await emis.command({ method: "addLink", from: emis.id(from), to: emis.id(to), type: "blocks" });
}

async function attachPr(emis: Emis, number: number): Promise<void> {
  const step = [...stepSpecs().values()].find((s) => s.pr?.number === number);
  if (step?.pr === undefined) throw new Error(`no step carries the pull request #${number}`);
  const state = mergedByPoller(step) ? "open" : step.pr.state;
  const ref: ExternalRef = {
    kind: "github_pr",
    url: prUrl(number),
    ...step.pr,
    state,
    base: null,
    head: null,
  };
  await emis.command({ method: "upsertExternalRef", ticketId: emis.id(step.n), ref });
}

async function attachGit(emis: Emis): Promise<void> {
  for (const step of stepSpecs().values()) {
    const ticketId = emis.id(step.n);
    if (step.pr !== undefined && step.pr.number !== EMIS_CLOSING.opened) await attachPr(emis, step.pr.number);
    if (step.branch !== undefined) {
      const ref: ExternalRef = { kind: "git_branch", branch: step.branch, base: EMIS_BASE_BRANCH };
      await emis.command({ method: "upsertExternalRef", ticketId, ref });
    }
  }
}

async function askQuestions(emis: Emis): Promise<void> {
  for (const q of EMIS_QUESTIONS) {
    await emis.command({
      method: "createQuestion",
      ticketId: emis.id(q.ticket),
      title: q.title,
      blocking: q.blocking,
      recipient: q.recipient,
      createdBy: { kind: "human", ref: emis.user },
      importRef: { kind: "import_ref", source: "plan", id: q.id },
    });
  }
}

async function addPages(emis: Emis): Promise<void> {
  for (const [title, component] of EMIS_PAGES) {
    const page = await emis.command({ method: "addPage", title, kind: "view" });
    await emis.command({ method: "addInstance", pageId: textOf(page, "id"), component });
  }
}

async function startSessions(rpc: SeedRpc, projectId: string): Promise<void> {
  for (const { n, tool } of EMIS_SESSIONS)
    await rpc({
      method: "setTicketSession",
      projectId,
      ticketKey: emisKey(n),
      cwd: null,
      state: "start",
      tool,
    });
}

async function seedEmis(rpc: SeedRpc, projectId: string, user: string, options: SeedOptions): Promise<void> {
  const ids = new Map<number, string>();
  const emis: Emis = {
    command: (command) => rpc({ method: "command", projectId, command }),
    id(n) {
      const id = ids.get(n);
      if (id === undefined) throw new Error(`${emisKey(n)} was not created`);
      return id;
    },
    user,
    projectId,
  };
  await buildTickets(emis, ids);
  await rpc({ method: "updateProject", projectId, patch: { description: EMIS_DESCRIPTION } });
  await addPages(emis);
  const deliveries = deliveryOrder([...stepSpecs().values()]);
  const closing = deliveries.find((s) => s.n === EMIS_CLOSING.delivery);
  if (closing === undefined) throw new Error(`${emisKey(EMIS_CLOSING.delivery)} has no delivery step`);
  const deliver = async (step: typeof closing) => {
    await rpc({ method: "setDeliveryStep", projectId, ticketKey: emisKey(step.n), step: step.delivery });
    await distinctInstant();
  };
  for (const step of deliveries.filter((s) => s !== closing)) await deliver(step);
  await startSessions(rpc, projectId);
  await options.mergePr(EMIS_CLOSING.merged);
  await waitForMerge(rpc, projectId, EMIS_CLOSING.merged, options.wait);
  await seedEmisAgent(rpc, projectId);
  await deliver(closing);
  await attachPr(emis, EMIS_CLOSING.opened);
  await verifyEmisJournal(rpc, projectId);
}

async function buildTickets(emis: Emis, ids: Map<number, string>): Promise<void> {
  await createTickets(emis, ids);
  await shapeFeatures(emis);
  await planSprints(emis);
  await linkTickets(emis);
  await askQuestions(emis);
  await attachGit(emis);
}

async function seedInbox(rpc: SeedRpc): Promise<void> {
  const inbox = await rpc({ method: "getProject", projectId: INBOX_ID });
  const titles = new Set(listOf(field(inbox, "tickets")).map((t) => textOf(t, "title")));
  for (const title of INBOX_TITLES.filter((t) => !titles.has(t)))
    await rpc({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title } });
}

async function nameWorkspace(rpc: SeedRpc): Promise<void> {
  const config = await rpc({ method: "getConfig" });
  if (field(config, "workspaceName") === EMIS_WORKSPACE_NAME) return;
  await rpc({
    method: "config",
    command: { method: "updateWorkspace", patch: { name: EMIS_WORKSPACE_NAME } },
  });
}

export async function seedEmisMaquettes(rpc: SeedRpc, options: SeedOptions): Promise<SeedResult> {
  const user = textOf(await rpc({ method: "getSession" }), "user");
  const created = await ensureProject(rpc, EMIS_PROJECT, options.folder);
  if (created !== null) await seedEmis(rpc, created, user, options);
  for (const spec of OTHER_PROJECTS) await ensureProject(rpc, spec, null);
  await seedInbox(rpc);
  await nameWorkspace(rpc);
  const projectId = await findProject(rpc, EMIS_PROJECT.key);
  if (projectId === null) throw new Error("the Emis project vanished");
  return { projectId, seeded: created !== null };
}

export const isEmisSeeded = (config: unknown): boolean =>
  field(config, "workspaceName") === EMIS_WORKSPACE_NAME;
