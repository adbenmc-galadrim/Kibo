import { ComponentManifest } from "@kibo/schema";
import manifestJson from "../kibo.component.json";
import { Kanban } from "./Kanban";

export const manifest = ComponentManifest.parse(manifestJson);
export const Component = Kanban;
