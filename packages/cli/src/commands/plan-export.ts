import type { Parsed } from "../args";
import { frPlan } from "../fr-plan";
import type { Connect, SessionIo } from "./daemon-session";

export async function planExport(
  _flags: Parsed["flags"],
  io: SessionIo,
  _connect?: Connect,
): Promise<number> {
  io.err(frPlan.usage);
  return 2;
}
