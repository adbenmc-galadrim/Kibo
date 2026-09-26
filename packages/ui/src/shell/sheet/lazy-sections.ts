import { lazyPanel } from "@kibo/sdk";
import type { ComponentType } from "react";
import { fr } from "../../i18n/fr";

type Sections = typeof import("./sections");

const section = <P extends object>(pick: (m: Sections) => ComponentType<P>) =>
  lazyPanel(() => import("./sections").then(pick), fr.lazy, { fallback: "sr-only" });

export const GithubRefs = section((m) => m.GithubRefs);
export const FigmaProperty = section((m) => m.FigmaProperty);
export const SyncStatus = section((m) => m.SyncStatus);
export const CiSection = section((m) => m.CiSection);
export const FigmaSection = section((m) => m.FigmaSection);
