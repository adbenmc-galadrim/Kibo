import { lazyPanel } from "@kibo/sdk";
import type { ComponentType } from "react";
import { fr } from "../../i18n/fr";

const section = <P extends object>(load: () => Promise<ComponentType<P>>) =>
  lazyPanel(load, fr.lazy, { fallback: "sr-only" });

export const GithubRefs = section(() => import("./sections").then((m) => m.GithubRefs));
export const GithubLinkNote = section(() => import("./sections").then((m) => m.GithubLinkNote));
export const DesignProperty = section(() => import("./sections").then((m) => m.DesignProperty));
export const CiSection = section(() => import("./sections").then((m) => m.CiSection));
export const DesignSection = section(() => import("./sections").then((m) => m.DesignSection));
