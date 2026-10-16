import { type ComponentSettings, DEFAULT_COMPONENT_SETTINGS } from "@kibo/schema";
import { useSdk } from "../react";
import { type Read, useSdkValue, type Watch } from "../sdk-value";

const readSettings: Read<ComponentSettings> = (sdk) => sdk.settings.get();
const watchSettings: Watch = (sdk, l) => sdk.settings.subscribe(l);

export function useComponentSettings(): ComponentSettings {
  return useSdkValue(useSdk(), readSettings, watchSettings, DEFAULT_COMPONENT_SETTINGS);
}
