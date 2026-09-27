import { ComponentManifest } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import manifestJson from "../kibo.component.json";
import { fr } from "./fr";

export const manifest = ComponentManifest.parse(manifestJson);
export const kanbanPanel = () => lazyPanel(() => import("./Kanban").then((m) => m.Kanban), fr.lazy);
export const Component = kanbanPanel();
