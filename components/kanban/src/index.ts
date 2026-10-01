import { ComponentManifest } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import manifestJson from "../kibo.component.json";
import { frLazy } from "./fr-lazy";

export const manifest = ComponentManifest.parse(manifestJson);
export const kanbanPanel = () => lazyPanel(() => import("./Kanban").then((m) => m.Kanban), frLazy);
export const Component = kanbanPanel();
