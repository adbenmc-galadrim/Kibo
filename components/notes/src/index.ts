import { ComponentManifest } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { createElement } from "react";
import manifestJson from "../kibo.component.json";
import { NotesView } from "./NotesView";
import { NotesWidget } from "./NotesWidget";

export const manifest = ComponentManifest.parse(manifestJson);

export function Component() {
  const sdk = useSdk();
  return createElement(sdk.surface === "view" ? NotesView : NotesWidget);
}
