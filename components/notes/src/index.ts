import { ComponentManifest } from "@kibo/schema";
import { lazyPanel, useSdk } from "@kibo/sdk";
import { createElement } from "react";
import manifestJson from "../kibo.component.json";
import { fr } from "./fr";
import { NotesWidget } from "./NotesWidget";

export const manifest = ComponentManifest.parse(manifestJson);

const NotesView = lazyPanel(() => import("./NotesView").then((m) => m.NotesView), fr.lazy);

export function Component() {
  const sdk = useSdk();
  return createElement(sdk.surface === "view" ? NotesView : NotesWidget);
}
