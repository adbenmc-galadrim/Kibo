import { join } from "node:path";
import { scaffold } from "@kibo/devkit";
import { fr } from "../fr";
import type { CliIo } from "../index";

export type ComponentKind = "widget" | "view" | "both";

export async function newCommand(
  id: string,
  kind: ComponentKind,
  server: boolean,
  io: CliIo,
): Promise<number> {
  const dir = await scaffold({
    root: join(io.home, "components", "src"),
    id,
    kind,
    server,
    toolchain: io.toolchain,
  });
  io.out(fr.created(dir));
  io.out(fr.next(id));
  return 0;
}
