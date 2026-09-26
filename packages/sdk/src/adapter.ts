import {
  bindingIdOf,
  type GithubIssueRef,
  type MappedRemote,
  PullInput,
  PushOp,
  type SyncedFields,
} from "@kibo/schema";
import type { ZodType, ZodTypeDef } from "zod";
import type { KiboSdk } from "./types";

export { BINDING_PREFIX, bindingIdOf } from "@kibo/schema";

export type AdapterContext<C> = { config: C; fetch: KiboSdk["fetch"]; signal: AbortSignal };

export type Adapter<R, C> = {
  id: string;
  remote: ZodType<R, ZodTypeDef, unknown>;
  config: ZodType<C, ZodTypeDef, unknown>;
  pull(
    ctx: AdapterContext<C>,
    cursor: string | null,
  ): Promise<{ items: unknown[]; cursor: string | null; more: boolean }>;
  push(ctx: AdapterContext<C>, op: PushOp): Promise<unknown>;
  map: {
    remoteId(r: R): string;
    updatedAt(r: R): string;
    toFields(r: R, c: C): SyncedFields;
    toRef(r: R, bindingId: string): GithubIssueRef;
    labels(r: R): string[];
  };
};

export type AdapterActionContext = { instanceId: string; config: unknown; fetch: KiboSdk["fetch"] };

const ADAPTER_TIMEOUT_MS = 120_000;

export function defineAdapter<R, C>(adapter: Adapter<R, C>): Adapter<R, C> {
  return adapter;
}

export function mapRemote<R, C>(
  adapter: Adapter<R, C>,
  raw: unknown,
  config: C,
  bindingId: string,
): MappedRemote {
  const r = adapter.remote.parse(raw);
  return {
    remoteId: adapter.map.remoteId(r),
    updatedAt: adapter.map.updatedAt(r),
    fields: adapter.map.toFields(r, config),
    ref: adapter.map.toRef(r, bindingId),
    labels: adapter.map.labels(r),
  };
}

export function adapterActions<R, C>(adapter: Adapter<R, C>) {
  const contextOf = (ctx: AdapterActionContext): AdapterContext<C> => ({
    config: adapter.config.parse(ctx.config),
    fetch: ctx.fetch,
    signal: AbortSignal.timeout(ADAPTER_TIMEOUT_MS),
  });
  return {
    "adapter.pull": async (ctx: AdapterActionContext, input: unknown) => {
      const { cursor } = PullInput.parse(input);
      const c = contextOf(ctx);
      const bindingId = bindingIdOf(ctx.instanceId);
      const page = await adapter.pull(c, cursor);
      return {
        items: page.items.map((raw) => mapRemote(adapter, raw, c.config, bindingId)),
        cursor: page.cursor,
        more: page.more,
      };
    },
    "adapter.push": async (ctx: AdapterActionContext, input: unknown) => {
      const op = PushOp.parse(input);
      const c = contextOf(ctx);
      return mapRemote(adapter, await adapter.push(c, op), c.config, bindingIdOf(ctx.instanceId));
    },
  };
}
