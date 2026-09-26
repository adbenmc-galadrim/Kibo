import { z } from "zod";
import { ComponentCall } from "./call";
import { ComponentManifest } from "./manifest";
import { StatusId } from "./status";

export const Theme = z.enum(["dark", "light"]);
export type Theme = z.infer<typeof Theme>;
export const Surface = z.enum(["widget", "view"]);
export type Surface = z.infer<typeof Surface>;
export const KeyCombo = z.enum([
  "mod+k",
  "mod+t",
  "mod+w",
  "mod+1",
  "mod+2",
  "mod+3",
  "mod+4",
  "mod+5",
  "mod+6",
  "mod+7",
  "mod+8",
  "mod+9",
  "escape",
]);
export type KeyCombo = z.infer<typeof KeyCombo>;

const Json = z.record(z.string(), z.unknown());
const WireError = z.object({ code: z.string(), message: z.string() });
const Reply = z.object({
  kibo: z.literal(1),
  type: z.literal("reply"),
  id: z.number().int(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: WireError.optional(),
});

export const HostToFrame = z.discriminatedUnion("type", [
  z.object({
    kibo: z.literal(1),
    type: z.literal("init"),
    instanceId: z.string(),
    config: Json,
    viewer: z.string(),
    theme: Theme,
    surface: Surface,
  }),
  z.object({ kibo: z.literal(1), type: z.literal("theme"), theme: Theme }),
  z.object({ kibo: z.literal(1), type: z.literal("changed") }),
  Reply,
]);
export type HostToFrame = z.infer<typeof HostToFrame>;
export type InitMessage = Extract<HostToFrame, { type: "init" }>;

export const FrameToHost = z.discriminatedUnion("type", [
  z.object({ kibo: z.literal(1), type: z.literal("ready") }),
  z.object({
    kibo: z.literal(1),
    type: z.literal("call"),
    id: z.number().int().nonnegative(),
    call: ComponentCall,
  }),
  z.object({ kibo: z.literal(1), type: z.literal("openTicket"), ticketId: z.string().min(1) }),
  z.object({
    kibo: z.literal(1),
    type: z.literal("openNewTicket"),
    defaults: z.object({ statusId: StatusId.optional(), parentId: z.string().nullable().optional() }),
  }),
  z.object({
    kibo: z.literal(1),
    type: z.literal("openFile"),
    path: z.string().min(1).max(1024),
    line: z.number().int().positive().optional(),
  }),
  z.object({ kibo: z.literal(1), type: z.literal("openView"), componentId: z.string().min(1).max(128) }),
  z.object({ kibo: z.literal(1), type: z.literal("key"), combo: KeyCombo }),
  z.object({ kibo: z.literal(1), type: z.literal("resize"), height: z.number().int().min(0).max(10_000) }),
]);
export type FrameToHost = z.infer<typeof FrameToHost>;

export const InvokeTarget = z.union([
  z.object({ action: z.string().min(1) }),
  z.object({ job: z.string().min(1) }),
  z.object({ migrate: z.object({ from: z.number().int(), to: z.number().int(), config: Json, data: Json }) }),
]);
export type InvokeTarget = z.infer<typeof InvokeTarget>;

export const BackendCode = z.object({ server: z.string().nullable(), migrations: z.string().nullable() });
export type BackendCode = z.infer<typeof BackendCode>;

const BackendResult = z.object({
  type: z.literal("result"),
  id: z.number().int(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: WireError.optional(),
});

export const DaemonToBackend = z.discriminatedUnion("type", [
  z.object({ type: z.literal("load"), manifest: ComponentManifest, code: BackendCode.optional() }),
  z.object({
    type: z.literal("invoke"),
    id: z.number().int(),
    instanceId: z.string(),
    config: Json,
    target: InvokeTarget,
    input: z.unknown(),
  }),
  BackendResult,
]);
export type DaemonToBackend = z.infer<typeof DaemonToBackend>;

export const BackendDescription = z.object({
  actions: z.array(z.string()),
  jobs: z.array(z.object({ name: z.string(), everyMinutes: z.number().int().min(1) })),
});
export type BackendDescription = z.infer<typeof BackendDescription>;

export const BackendToDaemon = z.discriminatedUnion("type", [
  BackendDescription.extend({ type: z.literal("ready") }),
  z.object({
    type: z.literal("call"),
    id: z.number().int(),
    invocation: z.number().int(),
    call: ComponentCall,
  }),
  BackendResult,
]);
export type BackendToDaemon = z.infer<typeof BackendToDaemon>;
