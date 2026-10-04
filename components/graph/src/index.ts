import { ComponentManifest } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { createElement } from "react";
import manifestJson from "../kibo.component.json";
import { GraphView, GraphWidget } from "./lazy-panels";

export const manifest = ComponentManifest.parse(manifestJson);

export function Component() {
  const sdk = useSdk();
  return createElement(sdk.surface === "view" ? GraphView : GraphWidget);
}
