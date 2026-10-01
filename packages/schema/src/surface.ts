import type { ComponentFormat } from "./format";
import type { ComponentManifest } from "./manifest";
import type { Surface } from "./protocol";

export const surfaceFor = (m: Pick<ComponentManifest, "kind">, format: ComponentFormat): Surface =>
  format === "full" && m.kind !== "widget" ? "view" : "widget";
