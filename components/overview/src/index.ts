import { ComponentManifest } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import manifestJson from "../kibo.component.json";
import { frLazy } from "./fr-lazy";

export const manifest = ComponentManifest.parse(manifestJson);
export const overviewPanel = () => lazyPanel(() => import("./Overview").then((m) => m.Overview), frLazy);
export const Component = overviewPanel();
