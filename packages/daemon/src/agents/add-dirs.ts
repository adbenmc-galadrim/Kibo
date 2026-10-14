import { type AgentSettings, isSafeAddDir, KiboError, type ProjectDelivery } from "@kibo/schema";

export type AddDirsIo = { home: string; exists(path: string): boolean; log(line: string): void };

export function assertAddDirs(dirs: readonly string[], home: string): void {
  const refused = dirs.find((dir) => !isSafeAddDir(dir, home));
  if (refused !== undefined)
    throw new KiboError(
      "INVALID_INPUT",
      `folder ${refused} cannot be added: it holds secrets or leaves the home folder`,
    );
}

export function addDirsOf(
  agent: Pick<AgentSettings, "addDirs">,
  project: Pick<ProjectDelivery, "addDirs"> | null,
  io: AddDirsIo,
): string[] {
  const dirs = [...new Set([...agent.addDirs, ...(project?.addDirs ?? [])])];
  assertAddDirs(dirs, io.home);
  return dirs.filter((dir) => {
    if (io.exists(dir)) return true;
    io.log(`added folder ${dir} is missing, ignored`);
    return false;
  });
}
