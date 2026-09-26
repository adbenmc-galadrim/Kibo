import { ComponentManifest } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import manifestJson from "../kibo.component.json";
import { fr } from "./fr";

export const manifest = ComponentManifest.parse(manifestJson);
export const Component = lazyPanel(() => import("./McpSource").then((m) => m.McpSource), fr.lazy);
export { defaultMcpSourceConfig, McpSourceConfig, type McpSourceStoredConfig, parseArgs } from "./config";
