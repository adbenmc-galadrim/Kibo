import {
  type Actor,
  type AutoLink,
  isOverlapRequest,
  KiboError,
  OVERLAP_RPC,
  type Overlap,
  type OverlapRpcRequest,
  type OverlapRpcResult,
  type ParallelWork,
} from "@kibo/schema";
import { type RpcExtension, requireLocal } from "../rpc-extensions";
import type { AutoLinker } from "./auto-link";
import { overlapLabel } from "./label";
import type { OverlapSides } from "./read";
import type { OverlapStore } from "./store";

export type OverlapRpcServices = {
  store: OverlapStore;
  read(id: string): Promise<OverlapSides>;
  parallelWork(runId: string): Promise<ParallelWork>;
  linker: Pick<AutoLinker, "cancel">;
  data: { viewer(projectId: string): string; assertWritable(projectId: string): void };
  emit(): void;
  now(): number;
};

const METHODS = OVERLAP_RPC.map((schema) => schema.shape.method.value);

type Method = OverlapRpcRequest["method"];
type Handled<M extends Method> = Promise<OverlapRpcResult[M]>;

export function overlapRpc(services: OverlapRpcServices): RpcExtension {
  const { store, data } = services;

  const editor = (projectId: string): Actor => {
    data.assertWritable(projectId);
    return { kind: "human", ref: data.viewer(projectId) };
  };

  const overlapOf = (id: string): Overlap => {
    const overlap = store.get(id);
    if (!overlap) throw new KiboError("NOT_FOUND", `overlap ${id} not found`);
    return overlap;
  };

  const autoLinkOf = (id: string): AutoLink => {
    const link = store.autoLink.get(id);
    if (!link) throw new KiboError("NOT_FOUND", `auto link ${id} not found`);
    return link;
  };

  function ignore(id: string): Overlap {
    const target = overlapOf(id);
    const by = editor(target.projectId);
    const at = services.now();
    store.ignore(target.projectId, target.kind, target.key, overlapLabel(target.detail), by, at);
    const same = store.open(target.projectId).filter((o) => o.kind === target.kind && o.key === target.key);
    for (const o of same) store.event(o.id, { type: "ignored", role: null, by, at });
    services.emit();
    return overlapOf(id);
  }

  async function handle(req: OverlapRpcRequest): Handled<Method> {
    switch (req.method) {
      case "overlaps.list":
        return store.list({ projectId: req.projectId, runId: req.runId, state: req.state });
      case "overlaps.ignore":
        return ignore(req.id);
      case "overlaps.reactivate":
        editor(req.projectId);
        store.reactivate(req.projectId, req.kind, req.key);
        services.emit();
        return { ok: true };
      case "overlaps.ignored":
        return store.ignored(req.projectId);
      case "overlaps.read":
        return services.read(req.id);
      case "overlaps.parallel":
        return services.parallelWork(req.runId);
      case "autoLinks.list":
        return store.autoLink.list(req.projectId);
      case "autoLinks.cancel": {
        const link = autoLinkOf(req.id);
        const cancelled = services.linker.cancel(link.id, editor(link.projectId));
        services.emit();
        return cancelled;
      }
    }
  }

  return {
    methods: METHODS,
    async handle(req, ctx) {
      requireLocal(ctx);
      if (!isOverlapRequest(req)) throw new KiboError("INTERNAL", `${req.method} is not an overlap method`);
      return handle(req);
    },
  };
}
