import { DELIVERY_RPC_METHODS, KiboError } from "@kibo/schema";
import type { ZodError } from "zod";

const MAX_FIELDS = 5;

export function rpcRefusal(error: ZodError): string {
  const fields = [...new Set(error.issues.map((i) => i.path.join(".")).filter((p) => p !== ""))];
  return fields.length === 0
    ? "invalid request"
    : `invalid request: ${fields.slice(0, MAX_FIELDS).join(", ")}`;
}

const PENDING_METHODS: ReadonlySet<string> = new Set(DELIVERY_RPC_METHODS);

export function refusePending(method: string): void {
  if (PENDING_METHODS.has(method)) throw new KiboError("NOT_FOUND", `${method} is not served yet`);
}
