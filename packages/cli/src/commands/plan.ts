import type { Parsed } from "../args";
import { frPlan } from "../fr-plan";
import type { Connect, SessionIo } from "./daemon-session";
import { planApply } from "./plan-apply";
import { planExport } from "./plan-export";

export async function planCommand(
  positional: readonly string[],
  flags: Parsed["flags"],
  io: SessionIo,
  connect?: Connect,
  cwd: string = process.cwd(),
): Promise<number> {
  const [sub, file] = positional;
  if (sub === "export") return planExport(flags, io, connect);
  if (sub === "apply" && file !== undefined) return planApply(file, flags, io, connect, cwd);
  io.err(frPlan.usage);
  return 2;
}
