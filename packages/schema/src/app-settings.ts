import type { TrackingSettings } from "./tracking-settings";

export type ComponentSettings = { tracking: TrackingSettings | null };
export const DEFAULT_COMPONENT_SETTINGS: ComponentSettings = { tracking: null };
