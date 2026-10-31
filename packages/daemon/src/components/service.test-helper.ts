import type { Instance, Page, RpcRequest, RpcResult, TicketRun } from "@kibo/schema";
import { startNotes } from "../notes/bootstrap";
import { createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { type ComponentsService, createComponentsService } from "./service";

export const SANDBOX_ORIGIN = "http://127.0.0.1:4318";

export type Harness = {
  store: Store;
  service: Service;
  components: ComponentsService;
  rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]>;
  stop(): Promise<void>;
};

export type HarnessOptions = {
  runs?: (projectId: string) => TicketRun[];
  drainMs?: number;
  cliStatus?: () => Promise<{ path: string; installed: boolean }>;
};

export async function boot(home: string, opts: HarnessOptions = {}): Promise<Harness> {
  const store = openStore(home);
  const service = createService(store, { user: "adam" });
  const notes = await startNotes({ db: store.db, home, docs: service.docs });
  const components = createComponentsService({
    home,
    db: store.db,
    docs: service.docs,
    notes: notes.notes,
    sandboxOrigin: () => SANDBOX_ORIGIN,
    runs: opts.runs ?? (() => []),
    ...(opts.drainMs !== undefined && { drainMs: opts.drainMs }),
    ...(opts.cliStatus && { cliStatus: opts.cliStatus }),
  });
  const detach = service.attachComponents(components);
  return {
    store,
    service,
    components,
    rpc: async <R extends RpcRequest>(req: R) => (await service.handle(req)) as RpcResult[R["method"]],
    async stop() {
      detach();
      await components.stop();
      notes.stop();
      store.close();
    },
  };
}

export async function createProject(h: Harness): Promise<{ projectId: string; pageId: string }> {
  const meta = await h.rpc({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const page = (await h.rpc({
    method: "command",
    projectId: meta.id,
    command: { method: "addPage", title: "Tableau de bord", kind: "dashboard" },
  })) as Page;
  return { projectId: meta.id, pageId: page.id };
}

export async function addInstance(h: Harness, projectId: string, pageId: string, component: string) {
  const inst = await h.rpc({
    method: "command",
    projectId,
    command: { method: "addInstance", pageId, component },
  });
  return inst as Instance;
}
