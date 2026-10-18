import { lazyPanel } from "@kibo/sdk";
import { fr } from "../../i18n/fr";

export const RetiredRedirect = lazyPanel(
  () => import("./RetiredRedirect").then((m) => m.RetiredRedirect),
  fr.lazy,
  { fallback: "sr-only" },
);
