import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";

export const Overview = lazyPanel(() => import("../today/TodayPage").then((m) => m.TodayPage), fr.lazy, {
  fallback: "sr-only",
});
