import type { Parsed } from "../args";
import { frQuestions } from "../fr-questions";
import type { Connect, SessionIo } from "./daemon-session";

export async function questionsCommand(
  _positional: readonly string[],
  _flags: Parsed["flags"],
  io: SessionIo,
  _connect?: Connect,
  _cwd: string = process.cwd(),
): Promise<number> {
  io.err(frQuestions.usage);
  return 2;
}
