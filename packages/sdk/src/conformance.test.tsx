import { afterAll, expect } from "bun:test";
import { runConformance } from "./conformance";
import { useSdk } from "./react";

const rendered = new Set<string>();

function FormatProbe() {
  const sdk = useSdk();
  rendered.add(`${sdk.format} (${sdk.surface})`);
  return <p>{sdk.format}</p>;
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

afterAll(() => {
  expect([...rendered].sort()).toEqual(["full (view)", "small (widget)"]);
});
