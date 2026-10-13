import { z } from "zod";
import type { AutoLink, Overlap, OverlapIgnore, ParallelWork } from "./overlap";
import { OverlapKind, OverlapStatus } from "./overlap";

const Id = z.string().min(1);

export const OVERLAP_RPC = [
  z.object({
    method: z.literal("overlaps.list"),
    projectId: Id.optional(),
    runId: Id.optional(),
    state: OverlapStatus.optional(),
  }),
  z.object({ method: z.literal("overlaps.ignore"), id: Id }),
  z.object({ method: z.literal("overlaps.reactivate"), projectId: Id, kind: OverlapKind, key: Id }),
  z.object({ method: z.literal("overlaps.ignored"), projectId: Id }),
  z.object({ method: z.literal("overlaps.read"), id: Id }),
  z.object({ method: z.literal("overlaps.parallel"), runId: Id }),
  z.object({ method: z.literal("autoLinks.list"), projectId: Id }),
  z.object({ method: z.literal("autoLinks.cancel"), id: Id }),
] as const;

export type OverlapRpcRequest = z.infer<(typeof OVERLAP_RPC)[number]>;

export type OverlapSide = {
  runId: string;
  runName: string;
  path: string;
  content: string | null;
  reason: string | null;
};

export type OverlapRpcResult = {
  "overlaps.list": Overlap[];
  "overlaps.ignore": Overlap;
  "overlaps.reactivate": { ok: true };
  "overlaps.ignored": OverlapIgnore[];
  "overlaps.read": { owner: OverlapSide; other: OverlapSide };
  "overlaps.parallel": ParallelWork;
  "autoLinks.list": AutoLink[];
  "autoLinks.cancel": AutoLink;
};

const OVERLAP_METHODS: ReadonlySet<string> = new Set(OVERLAP_RPC.map((schema) => schema.shape.method.value));

export const isOverlapRequest = (req: { method: string }): req is OverlapRpcRequest =>
  OVERLAP_METHODS.has(req.method);
