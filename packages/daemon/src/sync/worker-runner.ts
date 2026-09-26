import { type Binding, KiboError, MappedRemote, PullPage } from "@kibo/schema";
import type { ZodType, ZodTypeDef } from "zod";
import type { AdapterRunner } from "../integrations/types";
import type { AdapterInvoker } from "./builtin-adapter";

type Action = "adapter.pull" | "adapter.push";

function ownedBy<T extends { ref: { bindingId: string } }>(binding: Binding, value: T): T {
  if (value.ref.bindingId !== binding.id)
    throw new KiboError("INTERNAL", "adapter returned a ref for another binding");
  return value;
}

function parseOut<T>(schema: ZodType<T, ZodTypeDef, unknown>, raw: unknown, what: string): T {
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new KiboError(
      "INTERNAL",
      `adapter returned an invalid ${what}: ${r.error.issues[0]?.message ?? ""}`,
    );
  return r.data;
}

export function createWorkerRunner(invoke: AdapterInvoker): AdapterRunner {
  const call = (projectId: string, b: Binding, action: Action, input: unknown) =>
    invoke({ projectId, bindingId: b.id, adapter: b.adapter, config: b.config, action, input });
  return {
    async pull(projectId, binding, cursor) {
      const page = parseOut(PullPage, await call(projectId, binding, "adapter.pull", { cursor }), "page");
      for (const item of page.items) ownedBy(binding, item);
      return page;
    },
    async push(projectId, binding, op) {
      const raw = await call(projectId, binding, "adapter.push", op);
      return ownedBy(binding, parseOut(MappedRemote, raw, "item"));
    },
  };
}
