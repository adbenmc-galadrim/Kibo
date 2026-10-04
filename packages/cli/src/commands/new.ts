import { join } from "node:path";
import { scaffold } from "@kibo/devkit";
import type { Template } from "@kibo/schema";
import { fr } from "../fr";
import type { CliIo } from "../index";

export type ComponentKind = "widget" | "view" | "both";

export async function newCommand(
  id: string,
  kind: ComponentKind,
  server: boolean,
  template: Template,
  io: CliIo,
): Promise<number> {
  const dir = await scaffold({
    root: join(io.home, "components", "src"),
    id,
    kind,
    server,
    template,
    toolchain: io.toolchain,
  });
  io.out(fr.created(dir));
  io.out(fr.next(id));
  return 0;
}
