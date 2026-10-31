import { realpathSync } from "node:fs";
import { type AgentSettings, isSafeAddDir, KiboError, type ProjectDelivery } from "@kibo/schema";

type AddDirsIo = { home: string; realpath(path: string): string | null; log(line: string): void };

const UNSAFE = "it holds secrets or leaves the home folder";

export function realpathOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return null;
    throw e;
  }
}

export function assertAddDirs(dirs: readonly string[], home: string): void {
  const refused = dirs.find((dir) => !isSafeAddDir(dir, home));
  if (refused !== undefined)
    throw new KiboError("INVALID_INPUT", `folder ${refused} cannot be added: ${UNSAFE}`);
}

export function addDirsOf(
  agent: Pick<AgentSettings, "addDirs">,
  project: Pick<ProjectDelivery, "addDirs"> | null,
  io: AddDirsIo,
): string[] {
  const declared = [...new Set([...agent.addDirs, ...(project?.addDirs ?? [])])];
  assertAddDirs(declared, io.home);
  const home = io.realpath(io.home) ?? io.home;
  const resolved = declared.flatMap((dir) => {
    const real = io.realpath(dir);
    if (real === null) {
      io.log(`added folder ${dir} is missing, ignored`);
      return [];
    }
    if (!isSafeAddDir(real, home))
      throw new KiboError(
        "INVALID_INPUT",
        `folder ${dir} resolves to ${real} and cannot be added: ${UNSAFE}`,
      );
    return [real];
  });
  return [...new Set(resolved)];
}
