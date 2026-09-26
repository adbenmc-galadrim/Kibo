import { ComponentManifest } from "@kibo/schema";
import { lazyPanel, useSdk } from "@kibo/sdk";
import { createElement } from "react";
import manifestJson from "../kibo.component.json";
import { fr } from "./fr";
import { GraphWidget } from "./GraphWidget";

export const manifest = ComponentManifest.parse(manifestJson);

const GraphView = lazyPanel(() => import("./GraphView").then((m) => m.GraphView), fr.lazy);

export function Component() {
  const sdk = useSdk();
  return createElement(sdk.surface === "view" ? GraphView : GraphWidget);
}
