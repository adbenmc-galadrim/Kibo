import type { SandboxStatus } from "@kibo/schema";
import { frSecurity } from "../i18n/fr-security";

const t = frSecurity.isolation;

export function sandboxProblem(status: SandboxStatus): string {
  if (status.kind === null) return t.problems.none;
  if (status.kind === "sandbox-exec") return t.problems.sandboxExec;
  if (status.reason?.includes("not installed")) return t.problems.bwrapMissing;
  if (status.fix?.includes("userns")) return t.problems.userns;
  return t.problems.bwrapFailed;
}

export function sandboxActive(status: SandboxStatus): string {
  return status.kind === "sandbox-exec" ? t.sandboxExec : t.bwrap;
}

export function sandboxStopped(status: SandboxStatus): boolean {
  return !status.available && !status.allowUnsandboxed;
}
