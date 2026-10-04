import { afterAll, expect } from "bun:test";
import { runConformance } from "./conformance";
import { useFocusMode, useSdk, useSelection } from "./react";

const rendered = new Set<string>();
const modes = new Set<string>();

function FormatProbe() {
  const sdk = useSdk();
  rendered.add(`${sdk.format} (${sdk.surface})`);
  return <p>{sdk.format}</p>;
}

function ModeProbe() {
  const focus = useFocusMode();
  const [selection] = useSelection();
  if (focus.active) modes.add("focus");
  if (selection) modes.add(`selection ${selection.ids.length}`);
  return <p>{focus.active ? "focus" : "inline"}</p>;
}

runConformance({
  manifest: {
    id: "acme.formats",
    version: "0.1.0",
    kind: "both",
    title: "Formats",
    reads: [],
    writes: [],
    formats: ["small", "full"],
  },
  Component: FormatProbe,
});

runConformance(
  {
    manifest: {
      id: "acme.modes",
      version: "0.1.0",
      kind: "widget",
      title: "Modes",
      reads: [],
      writes: [],
      formats: ["medium"],
      capabilities: ["fullscreen"],
      selection: true,
    },
    Component: ModeProbe,
  },
  (run) => run({ method: "createTicket", title: "A" }),
);

afterAll(() => {
  expect([...rendered].sort()).toEqual(["full (view)", "small (widget)"]);
  expect([...modes].sort()).toEqual(["focus", "selection 1"]);
});
