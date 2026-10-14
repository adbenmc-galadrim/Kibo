import type { ImportProbe } from "@kibo/core";
import { createProjectDoc, executeProjectCommand, readProject } from "@kibo/core";
import type {
  IndexedFile,
  MomentData,
  ProjectCommand,
  RunView,
  Ticket,
  WorkspaceIndex,
  WorkspaceRun,
} from "@kibo/schema";
import { tmp } from "../agents/git-test-kit";
import type { CommandMeta } from "../docs";
import { createAutoLinker } from "./auto-link";
import { indexedFile, NOW, ticketRun, workspaceIndex } from "./peek-fakes.test-helper";
import { openOverlapStore } from "./store";

export const P = "P";
export type Logged = {
  projectId: string;
  command: ProjectCommand;
  meta: CommandMeta;
  fromStatus: string | null;
};
export type ProbeTable = Record<string, Record<string, { path: string; added: boolean; exports: string[] }>>;

export type LinkWorldOptions = { titles?: readonly string[]; refuse?: (command: ProjectCommand) => void };

export function linkWorld(opts: LinkWorldOptions = {}) {
  const titles = opts.titles ?? ["Format", "Suivi"];
  const doc = createProjectDoc({
    id: P,
    key: "BOU",
    name: "Boutique",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
  });
  const tickets = titles.map(
    (title) =>
      executeProjectCommand(doc, { method: "createTicket", title, statusId: "in_progress" }) as Ticket,
  );
  const log: Logged[] = [];
  const moments: { runId: string; data: MomentData }[] = [];
  const runs: RunView[] = [];
  const probeTable: ProbeTable = {};
  const store = openOverlapStore(tmp());
  const docs = {
    run(projectId: string, command: ProjectCommand, meta: CommandMeta): unknown {
      const from = command.method === "addLink" ? command.from : null;
      const fromStatus = readProject(doc).tickets.find((t) => t.id === from)?.statusId ?? null;
      log.push({ projectId, command, meta, fromStatus });
      opts.refuse?.(command);
      return executeProjectCommand(doc, command);
    },
  };
  const probe =
    (index: WorkspaceIndex): ImportProbe =>
    (fromPath, spec) =>
      probeTable[index.key]?.[`${fromPath}|${spec}`] ?? null;
  const linker = createAutoLinker({
    store,
    docs,
    snapshot: () => readProject(doc),
    run: (id) => runs.find((r) => r.id === id) ?? null,
    probes: probe,
    moment: (runId, data) => moments.push({ runId, data }),
    now: () => NOW,
  });
  const addRun = (id: string, ticket: Ticket, over: Partial<RunView> = {}): RunView => {
    const run = ticketRun(id, ticket.key ?? ticket.id, { ticketId: ticket.id, ...over });
    runs.push(run);
    return run;
  };
  return { doc, tickets, log, moments, runs, store, linker, probeTable, addRun };
}

export const wsRun = (key: string, runId: string, startedAt = NOW): WorkspaceRun => ({
  key,
  runId,
  startedAt,
});

export const importing = (path: string, spec: string, names: string[]): IndexedFile =>
  indexedFile(path, { imports: [{ spec, names, line: 1 }] });

export const exporting = (path: string, names: string[], over: Partial<IndexedFile> = {}): IndexedFile =>
  indexedFile(path, { exports: names, ...over });

export { indexedFile, NOW, workspaceIndex };
