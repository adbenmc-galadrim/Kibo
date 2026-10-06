import { ComponentManifest } from "@kibo/schema";
import { lazyPanel, useSdk } from "@kibo/sdk";
import { createElement } from "react";
import manifestJson from "../kibo.component.json";
import { fr } from "./fr";

export const manifest = ComponentManifest.parse(manifestJson);

const NotesView = lazyPanel(() => import("./NotesView").then((m) => m.NotesView), fr.lazy);

const NotesWidget = lazyPanel(() => import("./NotesWidget").then((m) => m.NotesWidget), fr.lazy);

export function Component() {
  const sdk = useSdk();
  return createElement(sdk.surface === "view" ? NotesView : NotesWidget);
}
