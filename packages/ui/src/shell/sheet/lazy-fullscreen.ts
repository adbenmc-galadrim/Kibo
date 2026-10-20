import { lazyPanel } from "@kibo/sdk";
import { fr } from "../../i18n/fr";

export const FrameFullscreen = lazyPanel(
  () => import("@kibo/component-mockup/fullscreen").then((m) => m.FrameFullscreen),
  fr.lazy,
  { fallback: "sr-only" },
);
