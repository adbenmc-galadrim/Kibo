import { lazyPanel } from "@kibo/sdk";
import type { ComponentType } from "react";
import { fr } from "../i18n/fr";

type Parts = typeof import("./parts");

const part = <P extends object>(pick: (m: Parts) => ComponentType<P>) =>
  lazyPanel(() => import("./parts").then(pick), fr.lazy, { fallback: "sr-only" });

export const DeliverButton = part((m) => m.DeliverButton);
export const DeliveryLine = part((m) => m.DeliveryLine);
export const DeliverChildrenDialog = part((m) => m.DeliverChildrenDialog);
