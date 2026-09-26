import { createProjectDoc, executeProjectCommand, readProject } from "@kibo/core";
import { type ComponentManifest, KiboError, type ProjectCommand, type ProjectSnapshot } from "@kibo/schema";
import { createSdk } from "./sdk";
import type { FileOpenRequest, KiboSdk, NewTicketDefaults } from "./types";

export type MockSdk = {
  sdk: KiboSdk;
  violations: string[];
  opened: string[];
  newTicketRequests: NewTicketDefaults[];
  openedFiles: FileOpenRequest[];
  run(cmd: ProjectCommand): unknown;
  snapshot(): ProjectSnapshot;
};

export type MockSdkOptions = {
  seed?: (run: (cmd: ProjectCommand) => unknown) => void;
  viewer?: string;
  config?: Record<string, unknown>;
};

export function createMockSdk(manifest: ComponentManifest, opts: MockSdkOptions = {}): MockSdk {
  const doc = createProjectDoc({ id: "mock", key: "KIB", name: "Mock", folder: null, color: "#71717A" });
  const listeners = new Set<() => void>();
  const run = (cmd: ProjectCommand) => {
    const result = executeProjectCommand(doc, cmd);
    for (const l of listeners) l();
    return result;
  };
  opts.seed?.(run);
  const violations: string[] = [];
  const opened: string[] = [];
  const newTicketRequests: NewTicketDefaults[] = [];
  const openedFiles: FileOpenRequest[] = [];
  const inner = createSdk(
    {
      snapshot: async () => readProject(doc),
      run: async (cmd) => run(cmd),
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
    manifest,
    {
      instanceId: "mock-instance",
      config: opts.config ?? {},
      viewer: opts.viewer ?? "adam",
      openTicket: (id) => opened.push(id),
      openNewTicket: (d) => newTicketRequests.push(d),
      openFile: (r) => openedFiles.push(r),
    },
  );
  const record = async <T>(label: string, p: Promise<T>): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      if (e instanceof KiboError && e.code === "PERMISSION_DENIED") violations.push(label);
      throw e;
    }
  };
  const sdk: KiboSdk = {
    ...inner,
    list: (type) => record(`read ${type}`, inner.list(type)),
    run: (cmd) => record(`write ${cmd.method}`, inner.run(cmd)),
  };
  return { sdk, violations, opened, newTicketRequests, openedFiles, run, snapshot: () => readProject(doc) };
}
