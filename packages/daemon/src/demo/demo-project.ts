import { createHash } from "node:crypto";
import {
  DEMO_PROJECT_KEY,
  formatRef,
  Instance,
  KiboError,
  Link,
  NoteContent,
  Page,
  type ProjectCommand,
  ProjectMeta,
  type RpcRequest,
  Ticket,
  type TutorialSeed,
} from "@kibo/schema";
import type { z } from "zod";
import type { ProjectSettings } from "../notes/settings";
import { DEMO_COMPONENT_VERSION, DEMO_LINKS, DEMO_NOTE, DEMO_PAGES, DEMO_TICKETS } from "./demo-seed";

export const DEMO_FLAG = "demo";
export const DEMO_AGENT_PROFILE = "demo";
export const DEMO_PROJECT_NAME = "Démo Kibo";
const DEMO_COLOR = "#F97316";

export type DemoProjectDeps = {
  handle(req: RpcRequest): Promise<unknown>;
  settings: Pick<ProjectSettings, "set">;
};

export const isDemoProject = (settings: Pick<ProjectSettings, "get">, projectId: string): boolean =>
  settings.get(projectId, DEMO_FLAG) === "1";

export const noteHashOf = (markdown: string): string => createHash("sha256").update(markdown).digest("hex");

export const linkKeyOf = (l: Pick<Link, "from" | "to" | "type">): string => `${l.from}>${l.to}:${l.type}`;

async function rejectExistingDemo(deps: DemoProjectDeps): Promise<void> {
  const projects = ProjectMeta.array().parse(await deps.handle({ method: "listProjects" }));
  if (projects.some((p) => p.key === DEMO_PROJECT_KEY))
    throw new KiboError("CONFLICT", "the demo project already exists");
}

function commandOf(deps: DemoProjectDeps, projectId: string) {
  return async <S extends z.ZodTypeAny>(schema: S, command: ProjectCommand): Promise<z.infer<S>> =>
    schema.parse(await deps.handle({ method: "command", projectId, command }));
}

async function seedPages(run: ReturnType<typeof commandOf>) {
  const pages: Page[] = [];
  const instances: Instance[] = [];
  for (const page of DEMO_PAGES) {
    const created = await run(Page, { method: "addPage", title: page.title, kind: page.kind });
    pages.push(created);
    for (const c of page.components) {
      const component = formatRef(c.id, DEMO_COMPONENT_VERSION);
      const layout = c.layout ? { layout: c.layout } : {};
      instances.push(
        await run(Instance, { method: "addInstance", pageId: created.id, component, ...layout }),
      );
    }
  }
  return { pages, instances };
}

async function seedTickets(run: ReturnType<typeof commandOf>) {
  const ids = new Map<string, string>();
  for (const t of DEMO_TICKETS) {
    const parentId = t.parent ? ids.get(t.parent) : undefined;
    const ticket = await run(Ticket, {
      method: "createTicket",
      title: t.title,
      description: t.description,
      statusId: t.status,
      ...(t.blockedReason !== undefined && { blockedReason: t.blockedReason }),
      ...(parentId !== undefined && { parentId }),
    });
    ids.set(t.ref, ticket.id);
  }
  const links: Link[] = [];
  for (const l of DEMO_LINKS) {
    const from = ids.get(l.from);
    const to = ids.get(l.to);
    if (!from || !to) throw new KiboError("INTERNAL", `demo link ${l.from} > ${l.to} has no ticket`);
    links.push(await run(Link, { method: "addLink", from, to, type: l.type }));
  }
  return { ticketIds: [...ids.values()], links };
}

async function seedNote(deps: DemoProjectDeps, projectId: string, instanceId: string): Promise<string> {
  const call = (call: Extract<RpcRequest, { method: "componentCall" }>["call"]) =>
    deps.handle({ method: "componentCall", projectId, instanceId, call });
  try {
    await call({ kind: "notes.create", path: DEMO_NOTE.path, markdown: DEMO_NOTE.markdown });
    return noteHashOf(DEMO_NOTE.markdown);
  } catch (e) {
    if (!(e instanceof KiboError && e.code === "CONFLICT")) throw e;
    const kept = NoteContent.parse(await call({ kind: "notes.read", path: DEMO_NOTE.path }));
    return noteHashOf(kept.markdown);
  }
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
    }),
  );
  deps.settings.set(meta.id, DEMO_FLAG, "1");
  const run = commandOf(deps, meta.id);
  const { pages, instances } = await seedPages(run);
  const { ticketIds, links } = await seedTickets(run);
  const [dashboard, , graph] = pages;
  if (!dashboard || !graph) throw new KiboError("INTERNAL", "the demo pages were not created");
  const widgets = instances.filter((i) => i.pageId === dashboard.id);
  const notes = widgets.find((i) => i.component.startsWith("notes@"));
  if (!notes) throw new KiboError("INTERNAL", "the demo dashboard has no notes widget");
  const noteHash = await seedNote(deps, meta.id, notes.id);
  return {
    projectId: meta.id,
    seed: {
      ticketIds,
      linkKeys: links.map(linkKeyOf),
      layouts: Object.fromEntries(widgets.map((i) => [i.id, i.layout])),
      noteHash,
      dashboardPageId: dashboard.id,
      graphPageId: graph.id,
    },
  };
}
