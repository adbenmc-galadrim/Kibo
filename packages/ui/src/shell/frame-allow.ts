import type { Capability } from "@kibo/schema";

const granted = (on: boolean): string => (on ? "*" : "'none'");

export const allowAttribute = (capabilities: readonly Capability[]): string =>
  [
    `autoplay ${granted(capabilities.includes("audio"))}`,
    `gamepad ${granted(capabilities.includes("gamepad"))}`,
    "fullscreen 'none'",
    "camera 'none'",
    "microphone 'none'",
    "geolocation 'none'",
  ].join("; ");
