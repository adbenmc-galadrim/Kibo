import { ComponentManifest } from "@kibo/schema";
import manifestJson from "../kibo.component.json";
import { TicketsTree } from "./TicketsTree";

export const manifest = ComponentManifest.parse(manifestJson);
export const Component = TicketsTree;
