import type { Parsed } from "../args";
import { frPlan } from "../fr-plan";
import type { Connect, SessionIo } from "./daemon-session";

export async function planApply(
  _file: string,
  _flags: Parsed["flags"],
  io: SessionIo,
  _connect?: Connect,
  _cwd: string = process.cwd(),
): Promise<number> {
  io.err(frPlan.usage);
  return 2;
}
