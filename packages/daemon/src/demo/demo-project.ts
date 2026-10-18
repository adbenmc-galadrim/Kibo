import {
  DEMO_PROJECT_KEY,
  Instance,
  KiboError,
  Link,
  Page,
  type ProjectCommand,
  ProjectMeta,
  Question,
  type RpcRequest,
  Sprint,
  Ticket,
  type TicketView,
  type TutorialSeed,
} from "@kibo/schema";
import { z } from "zod";
import { noteHashOf } from "../notes/note-hash";
import type { ProjectSettings } from "../notes/settings";
import {
  DEMO_CLIENT,
  DEMO_FEATURES,
  DEMO_LINKS,
  DEMO_QUESTION,
  DEMO_ROLES,
  type DemoStep,
  demoPrUrl,
  demoSetup,
} from "./demo-seed";

export const DEMO_FLAG = "demo";
export const DEMO_PROJECT_NAME = "Démo Kibo";
const DEMO_COLOR = "#F97316";
const DEMO_ACTOR = { kind: "human", ref: "demo" } as const;

export type DemoProjectDeps = {
  handle(req: RpcRequest): Promise<unknown>;
  settings: Pick<ProjectSettings, "set">;
  today(): string;
};

export const isDemoProject = (settings: Pick<ProjectSettings, "get">, projectId: string): boolean =>
  settings.get(projectId, DEMO_FLAG) === "1";

export const hasLinkedRepo = (
  settings: Pick<ProjectSettings, "get">,
  projectId: string,
  hasLocalFolder: boolean,
): boolean => hasLocalFolder || isDemoProject(settings, projectId);

export { noteHashOf };

async function rejectExistingDemo(deps: DemoProjectDeps): Promise<void> {
  const projects = ProjectMeta.array().parse(await deps.handle({ method: "listProjects" }));
  if (projects.some((p) => p.key === DEMO_PROJECT_KEY))
    throw new KiboError("CONFLICT", "the demo project already exists");
}

type Run = <S extends z.ZodTypeAny>(schema: S, command: ProjectCommand) => Promise<z.infer<S>>;

function commandOf(deps: DemoProjectDeps, projectId: string): Run {
  return async (schema, command) =>
    schema.parse(await deps.handle({ method: "command", projectId, command }));
}

async function seedStep(run: Run, parentId: string, step: DemoStep): Promise<Ticket> {
  const ticket = await run(Ticket, {
    method: "createTicket",
    title: step.title,
    description: step.description,
    statusId: step.status,
    parentId,
  });
  if (ticket.key !== step.key) throw new KiboError("INTERNAL", `demo step ${step.key} got key ${ticket.key}`);
  if (step.branch)
    await run(Ticket, {
      method: "upsertExternalRef",
      ticketId: ticket.id,
      ref: { kind: "git_branch", branch: step.branch, base: "main" },
    });
  if (step.pr)
    await run(Ticket, {
      method: "upsertExternalRef",
      ticketId: ticket.id,
      ref: {
        kind: "github_pr",
        url: demoPrUrl(step.pr.number),
        number: step.pr.number,
        state: step.pr.state,
        base: "main",
        head: step.branch ?? null,
        review: "none",
        checks: null,
      },
    });
  return ticket;
}

const keyNumber = (step: DemoStep): number => Number(step.key.slice(step.key.lastIndexOf("-") + 1));

async function seedFeatures(run: Run, sprints: Sprint[]): Promise<Map<string, string>> {
  const pending: { rootId: string; step: DemoStep }[] = [];
  for (const feature of DEMO_FEATURES) {
    const root = await run(Ticket, {
      method: "createTicket",
      title: feature.title,
      description: feature.description,
      feature: true,
    });
    await run(Ticket, {
      method: "setTicketSprint",
      ticketId: root.id,
      sprintId: sprints[feature.sprint]?.id ?? null,
    });
    for (const step of feature.steps) pending.push({ rootId: root.id, step });
  }
  pending.sort((a, b) => keyNumber(a.step) - keyNumber(b.step));
  const ids = new Map<string, string>();
  for (const { rootId, step } of pending) ids.set(step.key, (await seedStep(run, rootId, step)).id);
  return ids;
}

async function seedLinksAndQuestion(run: Run, ids: Map<string, string>): Promise<void> {
  for (const l of DEMO_LINKS) {
    const from = ids.get(l.from);
    const to = ids.get(l.to);
    if (!from || !to) throw new KiboError("INTERNAL", `demo link ${l.from} > ${l.to} has no ticket`);
    await run(Link, { method: "addLink", from, to, type: "blocks" });
  }
  const ticketId = ids.get(DEMO_QUESTION.on);
  if (!ticketId) throw new KiboError("INTERNAL", `demo question has no ticket ${DEMO_QUESTION.on}`);
  await run(Question, {
    method: "createQuestion",
    ticketId,
    title: DEMO_QUESTION.title,
    context: DEMO_QUESTION.context,
    blocking: DEMO_QUESTION.blocking,
    recipient: DEMO_QUESTION.recipient,
    createdBy: DEMO_ACTOR,
  });
}

export type DemoProjectState = {
  pages: Page[];
  instances: Instance[];
  tickets: Pick<TicketView, "id" | "key" | "parentId">[];
  questions: Pick<Question, "id" | "ticketId" | "title">[];
};

const DemoProject = z.object({
  pages: Page.array(),
  instances: Instance.array(),
  tickets: Ticket.array(),
  questions: Question.array(),
  sprints: Sprint.array(),
});

const broken = (what: string) =>
  new KiboError("CONFLICT", `the demo project lost ${what}: delete it to start over`);

function pageWith(project: DemoProjectState, component: string): string {
  const pageId = project.instances.find((i) => i.component.startsWith(`${component}@`))?.pageId;
  if (!pageId || !project.pages.some((p) => p.id === pageId)) throw broken(`its ${component} page`);
  return pageId;
}

function ticketKeyed(project: DemoProjectState, key: string): string {
  const id = project.tickets.find((t) => t.key === key)?.id;
  if (!id) throw broken(`step ${key}`);
  return id;
}

export function seedFromProject(project: DemoProjectState): TutorialSeed {
  const questionTicket = ticketKeyed(project, DEMO_QUESTION.on);
  const question = project.questions.find(
    (q) => q.ticketId === questionTicket && q.title === DEMO_QUESTION.title,
  );
  if (!question) throw broken("its question");
  return {
    featureIds: project.tickets.filter((t) => t.parentId === null).map((t) => t.id),
    reviewTicketId: ticketKeyed(project, DEMO_ROLES.review),
    questionId: question.id,
    copyTicketId: ticketKeyed(project, DEMO_ROLES.copy),
    overviewPageId: pageWith(project, "overview"),
    planningPageId: pageWith(project, "planning"),
    kanbanPageId: pageWith(project, "kanban"),
    questionsPageId: pageWith(project, "questions"),
  };
}

export async function createDemoProject(
  deps: DemoProjectDeps,
): Promise<{ projectId: string; seed: TutorialSeed }> {
  await rejectExistingDemo(deps);
  const meta = ProjectMeta.parse(
    await deps.handle({
      method: "createProject",
      name: DEMO_PROJECT_NAME,
      key: DEMO_PROJECT_KEY,
      folder: null,
      color: DEMO_COLOR,
      client: DEMO_CLIENT,
      setup: demoSetup(deps.today()),
    }),
  );
  deps.settings.set(meta.id, DEMO_FLAG, "1");
  const run = commandOf(deps, meta.id);
  const read = async () => DemoProject.parse(await deps.handle({ method: "getProject", projectId: meta.id }));
  const ids = await seedFeatures(run, (await read()).sprints);
  await seedLinksAndQuestion(run, ids);
  return { projectId: meta.id, seed: seedFromProject(await read()) };
}
