import { lazyPanel } from "@kibo/sdk";
import { fr } from "../../i18n/fr";

export const RetiredRedirect = lazyPanel(
  () => import("./RetiredRedirect").then((m) => m.RetiredRedirect),
  fr.lazy,
  { fallback: "sr-only" },
);

export const RailProjectMenu = lazyPanel(
  () => import("./RailProjectMenu").then((m) => m.RailProjectMenu),
  fr.lazy,
  { fallback: "children" },
);
