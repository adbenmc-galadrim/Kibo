import { ComponentManifest } from "@kibo/schema";
import manifestJson from "../kibo.component.json";

export const manifest = ComponentManifest.parse(manifestJson);
export { githubIssuesAdapter } from "./adapter";
