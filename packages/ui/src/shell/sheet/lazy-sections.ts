import { lazyPanel } from "@kibo/sdk";
import type { ComponentType } from "react";
import { fr } from "../../i18n/fr";

type Sections = typeof import("./sections");

const section = <P extends object>(pick: (m: Sections) => ComponentType<P>) =>
  lazyPanel(() => import("./sections").then(pick), fr.lazy, { fallback: "sr-only" });

export const GithubRefs = section((m) => m.GithubRefs);
export const GithubLinkNote = section((m) => m.GithubLinkNote);
export const DesignProperty = section((m) => m.DesignProperty);
export const SyncStatus = section((m) => m.SyncStatus);
export const CiSection = section((m) => m.CiSection);
export const DesignSection = section((m) => m.DesignSection);
