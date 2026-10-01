import { ComponentManifest } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import manifestJson from "../kibo.component.json";
import { fr } from "./fr";

export const manifest = ComponentManifest.parse(manifestJson);
export const Component = lazyPanel(() => import("./TicketsTree").then((m) => m.TicketsTree), fr.lazy);
