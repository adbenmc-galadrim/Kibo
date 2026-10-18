import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";

export const Overview = lazyPanel(() => import("./HomeView").then((m) => m.HomeView), fr.lazy, {
  fallback: "sr-only",
});
