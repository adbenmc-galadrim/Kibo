import { ComponentManifest } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import manifestJson from "../kibo.component.json";
import { lazyLabels } from "./fr-lazy";

export const manifest = ComponentManifest.parse(manifestJson);

export const Component = lazyPanel(() => import("./Snake").then((m) => m.Snake), lazyLabels);
