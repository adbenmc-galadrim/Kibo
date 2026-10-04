import { expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMockSdk } from "./mock";
import { SdkProvider, useFocusMode, useSelection, useVisible } from "./react";

const base = {
  id: "probe",
  version: "0.1.0",
  kind: "widget" as const,
  title: "Probe",
  reads: [],
  writes: [],
};

function Probe() {
  const visible = useVisible();
  const focus = useFocusMode();
  const [selection, setSelection] = useSelection();
  return (
    <div>
      <p>
        {visible ? "visible" : "hidden"} · {focus.active ? "focused" : "inline"} ·{" "}
        {focus.available ? "available" : "unavailable"} · {selection?.ids.join(",") ?? "none"}
      </p>
      <button type="button" onClick={focus.request}>
        focus
      </button>
      <button type="button" onClick={() => setSelection(null)}>
        clear
      </button>
    </div>
  );
}

test("the hooks follow visibility, focus and selection", () => {
  const m = createMockSdk({ ...base, capabilities: ["fullscreen"], selection: true }, { visible: false });
  render(
    <SdkProvider sdk={m.sdk}>
      <Probe />
    </SdkProvider>,
  );
  expect(screen.getByText("hidden · inline · available · none")).toBeTruthy();
  act(() => {
    m.setVisible(true);
    m.setFocus(true);
    m.setSelection({ kind: "ticket", ids: ["a", "b"] });
  });
  expect(screen.getByText("visible · focused · available · a,b")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "focus" }));
  expect(m.focusRequests).toEqual([true]);
  fireEvent.click(screen.getByRole("button", { name: "clear" }));
  expect(m.selections).toEqual([null]);
  expect(screen.getByText("visible · focused · available · none")).toBeTruthy();
});

test("focus mode is unavailable without the fullscreen capability", () => {
  const m = createMockSdk(base);
  render(
    <SdkProvider sdk={m.sdk}>
      <Probe />
    </SdkProvider>,
  );
  expect(screen.getByText("visible · inline · unavailable · none")).toBeTruthy();
});
