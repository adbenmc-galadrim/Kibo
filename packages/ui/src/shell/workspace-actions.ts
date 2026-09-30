import type { TabTarget } from "@kibo/schema";
import { targetToHash } from "../tabs/target-hash";

export const inTauri = () => "__TAURI_INTERNALS__" in window;

export const openWindow = (t: TabTarget) =>
  window.open(`${location.pathname}${targetToHash(t)}`, "_blank", "noopener");
