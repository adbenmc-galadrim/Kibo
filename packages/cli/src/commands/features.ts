import type { Parsed } from "../args";
import { frFeatures } from "../fr-write";
import type { Connect, SessionIo } from "./daemon-session";

export async function featuresCommand(
  _positional: readonly string[],
  _flags: Parsed["flags"],
  io: SessionIo,
  _connect?: Connect,
  _cwd: string = process.cwd(),
): Promise<number> {
  io.err(frFeatures.usage);
  return 2;
}
