import type { TabTarget } from "@kibo/schema";
import { client } from "../api";
import { targetToHash } from "../tabs/target-hash";

export const renameWorkspace = async (name: string) => {
  await client.rpc({ method: "config", command: { method: "renameWorkspace", name } });
};

export const inTauri = () => "__TAURI_INTERNALS__" in window;

export const openWindow = (t: TabTarget) =>
  window.open(`${location.pathname}${targetToHash(t)}`, "_blank", "noopener");
