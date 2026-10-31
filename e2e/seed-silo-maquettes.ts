import {
  type ExternalRef,
  INBOX_ID,
  type ProjectCommand,
  type RpcRequest,
} from "../packages/schema/src/index";
import {
  INBOX_TITLES,
  OTHER_PROJECT_TICKETS,
  OTHER_PROJECTS,
  type ProjectSpec,
  prUrl,
  SILO_BASE_BRANCH,
  SILO_CLIENT,
  SILO_FEATURE_LINKS,
  SILO_FEATURES,
  SILO_LAST_TICKET,
  SILO_LOOSE_TICKETS,
  SILO_PAGES,
  SILO_PROJECT,
  SILO_QUESTIONS,
  SILO_RECENT_DELIVERIES,
  SILO_ROOT_ORDER,
  SILO_SPRINTS,
  SILO_STEP_LINKS,
  SILO_WORKSPACE_NAME,
  type SprintCode,
  type StepSpec,
  siloKey,
  siloSteps,
  siloUsedTickets,
} from "./fixtures/silo-maquettes";
import { SILO_CLOSING, SILO_DESCRIPTION, SILO_LATE_PR, SILO_SESSIONS } from "./fixtures/silo-suivi";
import { seedSiloAgent } from "./seed-silo-agent";
import { type JournalWait, verifySiloJournal, waitForMerge } from "./seed-silo-journal";

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

type Silo = {
  command(cmd: ProjectCommand): Promise<unknown>;
  id(n: number): string;
  user: string;
  projectId: string;
};

type DeliveredStep = StepSpec & { delivery: number };

const isDelivered = (s: StepSpec): s is DeliveredStep => s.delivery !== undefined;

function deliveryOrder(steps: readonly StepSpec[]): DeliveredStep[] {
  const delivered = steps.filter(isDelivered);
  const rank = (s: StepSpec) => SILO_RECENT_DELIVERIES.indexOf(s.n);
  return [
    ...delivered.filter((s) => rank(s) < 0),
    ...delivered.filter((s) => rank(s) >= 0).sort((a, b) => rank(a) - rank(b)),
  ];
}

const mergedByPoller = (step: StepSpec | undefined): boolean => step?.pr?.number === SILO_CLOSING.merged;

const descriptionOf = (text: string | undefined) => (text === undefined ? {} : { description: text });

const stepSpecs = (): Map<number, StepSpec> =>
  new Map([...siloSteps(), ...SILO_LOOSE_TICKETS].map((s) => [s.n, s]));

async function createTickets(silo: Silo, ids: Map<number, string>): Promise<void> {
  const steps = stepSpecs();
  const roots = new Map(SILO_FEATURES.map((f) => [f.n, f]));
  for (let n = 1; n <= SILO_LAST_TICKET; n += 1) {
    const step = steps.get(n);
    const root = roots.get(n);
    const created = await silo.command({
      method: "createTicket",
      title: step?.title ?? root?.title ?? `Brouillon ${n}`,
      statusId: mergedByPoller(step) ? "in_review" : (step?.status ?? "todo"),
      ...descriptionOf(step?.description ?? root?.result),
      ...(step?.mine ? { assignee: { kind: "human", ref: silo.user } } : {}),
    });
    ids.set(n, textOf(created, "id"));
  }
  const used = siloUsedTickets();
  for (let n = 1; n <= SILO_LAST_TICKET; n += 1) {
    if (!used.has(n)) await silo.command({ method: "deleteTicket", ticketId: silo.id(n) });
  }
}

async function shapeFeatures(silo: Silo): Promise<void> {
  for (const f of SILO_FEATURES) {
    for (const step of f.steps)
      await silo.command({ method: "moveTicket", ticketId: silo.id(step.n), parentId: silo.id(f.n) });
  }
  for (const [index, n] of SILO_ROOT_ORDER.entries())
    await silo.command({ method: "moveTicket", ticketId: silo.id(n), parentId: null, index });
  for (const step of siloSteps().filter((s) => s.optional === true))
    await silo.command({ method: "setTicketOptional", ticketId: silo.id(step.n), optional: true });
  for (const f of SILO_FEATURES.filter((x) => x.steps.every((s) => s.status === "done")))
    await silo.command({ method: "setStatus", ticketId: silo.id(f.n), statusId: "done" });
}

async function planSprints(silo: Silo): Promise<void> {
  const sprints = new Map<SprintCode, string>();
  for (const s of SILO_SPRINTS) {
    const created = await silo.command({ method: "createSprint", ...s });
    sprints.set(s.code, textOf(created, "id"));
  }
  const planned = [...SILO_FEATURES, ...SILO_LOOSE_TICKETS].flatMap((t) => {
    const sprintId = t.sprint === null ? undefined : sprints.get(t.sprint);
    return sprintId === undefined ? [] : [{ n: t.n, sprintId }];
  });
  for (const { n, sprintId } of planned)
    await silo.command({ method: "setTicketSprint", ticketId: silo.id(n), sprintId });
}

async function linkTickets(silo: Silo): Promise<void> {
  const rootOf = (shortKey: string): number => {
    const found = SILO_FEATURES.find((f) => f.shortKey === shortKey);
    if (found === undefined) throw new Error(`feature ${shortKey} is unknown`);
    return found.n;
  };
  const featureLinks = SILO_FEATURE_LINKS.map(([from, to]): [number, number] => [rootOf(from), rootOf(to)]);
  for (const [from, to] of [...SILO_STEP_LINKS, ...featureLinks])
    await silo.command({ method: "addLink", from: silo.id(from), to: silo.id(to), type: "blocks" });
}

async function attachPr(silo: Silo, number: number): Promise<void> {
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
  await silo.command({ method: "upsertExternalRef", ticketId: silo.id(step.n), ref });
}

async function attachGit(silo: Silo): Promise<void> {
  for (const step of stepSpecs().values()) {
    const ticketId = silo.id(step.n);
    const pr = step.pr?.number;
    if (pr !== undefined && pr !== SILO_CLOSING.opened && pr !== SILO_LATE_PR) await attachPr(silo, pr);
    if (step.branch !== undefined) {
      const ref: ExternalRef = { kind: "git_branch", branch: step.branch, base: SILO_BASE_BRANCH };
      await silo.command({ method: "upsertExternalRef", ticketId, ref });
    }
  }
  await attachPr(silo, SILO_LATE_PR);
}

async function askQuestions(silo: Silo): Promise<void> {
  for (const q of SILO_QUESTIONS) {
    await silo.command({
      method: "createQuestion",
      ticketId: silo.id(q.ticket),
      title: q.title,
      blocking: q.blocking,
      recipient: q.recipient,
      createdBy: { kind: "human", ref: silo.user },
      importRef: { kind: "import_ref", source: "plan", id: q.id },
    });
  }
}

async function addPages(silo: Silo): Promise<void> {
  for (const [title, component] of SILO_PAGES) {
    const page = await silo.command({ method: "addPage", title, kind: "view" });
    await silo.command({ method: "addInstance", pageId: textOf(page, "id"), component });
  }
}

async function startSessions(rpc: SeedRpc, projectId: string): Promise<void> {
  for (const { n, tool } of SILO_SESSIONS)
    await rpc({
      method: "setTicketSession",
      projectId,
      ticketKey: siloKey(n),
      cwd: null,
      state: "start",
      tool,
    });
}

async function seedSilo(rpc: SeedRpc, projectId: string, user: string, options: SeedOptions): Promise<void> {
  const ids = new Map<number, string>();
  const silo: Silo = {
    command: (command) => rpc({ method: "command", projectId, command }),
    id(n) {
      const id = ids.get(n);
      if (id === undefined) throw new Error(`${siloKey(n)} was not created`);
      return id;
    },
    user,
    projectId,
  };
  await buildTickets(silo, ids);
  await rpc({
    method: "updateProject",
    projectId,
    patch: { description: SILO_DESCRIPTION, client: SILO_CLIENT },
  });
  await addPages(silo);
  const deliveries = deliveryOrder([...stepSpecs().values()]);
  const closing = deliveries.find((s) => s.n === SILO_CLOSING.delivery);
  if (closing === undefined) throw new Error(`${siloKey(SILO_CLOSING.delivery)} has no delivery step`);
  const deliver = async (step: typeof closing) => {
    await rpc({ method: "setDeliveryStep", projectId, ticketKey: siloKey(step.n), step: step.delivery });
    await distinctInstant();
  };
  for (const step of deliveries.filter((s) => s !== closing)) await deliver(step);
  await startSessions(rpc, projectId);
  await options.mergePr(SILO_CLOSING.merged);
  await waitForMerge(rpc, projectId, SILO_CLOSING.merged, options.wait);
  await seedSiloAgent(rpc, projectId);
  await deliver(closing);
  await attachPr(silo, SILO_CLOSING.opened);
  await verifySiloJournal(rpc, projectId);
}

async function buildTickets(silo: Silo, ids: Map<number, string>): Promise<void> {
  await createTickets(silo, ids);
  await shapeFeatures(silo);
  await planSprints(silo);
  await linkTickets(silo);
  await askQuestions(silo);
  await attachGit(silo);
}

async function seedOtherProject(rpc: SeedRpc, spec: ProjectSpec): Promise<void> {
  const projectId = await ensureProject(rpc, spec, null);
  const tickets = OTHER_PROJECT_TICKETS[spec.key];
  if (projectId === null || tickets === undefined) return;
  const statuses = [
    ...Array.from({ length: tickets.done }, () => "done" as const),
    ...Array.from({ length: tickets.open }, () => "in_progress" as const),
  ];
  for (const [i, statusId] of statuses.entries())
    await rpc({
      method: "command",
      projectId,
      command: { method: "createTicket", title: `Ticket ${i + 1}`, statusId },
    });
}

async function seedInbox(rpc: SeedRpc): Promise<void> {
  const inbox = await rpc({ method: "getProject", projectId: INBOX_ID });
  const titles = new Set(listOf(field(inbox, "tickets")).map((t) => textOf(t, "title")));
  for (const title of INBOX_TITLES.filter((t) => !titles.has(t)))
    await rpc({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title } });
}

async function nameWorkspace(rpc: SeedRpc): Promise<void> {
  const config = await rpc({ method: "getConfig" });
  if (field(config, "workspaceName") === SILO_WORKSPACE_NAME) return;
  await rpc({
    method: "config",
    command: { method: "updateWorkspace", patch: { name: SILO_WORKSPACE_NAME } },
  });
}

export async function seedSiloMaquettes(rpc: SeedRpc, options: SeedOptions): Promise<SeedResult> {
  const user = textOf(await rpc({ method: "getSession" }), "user");
  const created = await ensureProject(rpc, SILO_PROJECT, options.folder);
  if (created !== null) await seedSilo(rpc, created, user, options);
  for (const spec of OTHER_PROJECTS) await seedOtherProject(rpc, spec);
  await seedInbox(rpc);
  await nameWorkspace(rpc);
  const projectId = await findProject(rpc, SILO_PROJECT.key);
  if (projectId === null) throw new Error("the Silo project vanished");
  return { projectId, seeded: created !== null };
}

export const isSiloSeeded = (config: unknown): boolean =>
  field(config, "workspaceName") === SILO_WORKSPACE_NAME;
