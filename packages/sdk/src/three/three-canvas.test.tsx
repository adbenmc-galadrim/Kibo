import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Color, WebGLRenderer } from "three";
import { createMockSdk, type MockSdk } from "../mock";
import { SdkProvider } from "../react";
import { ThreeCanvas } from "./ThreeCanvas";
import { ZINC_FALLBACK } from "./theme-colors";

afterEach(cleanup);

const mockSdk = () =>
  createMockSdk({
    id: "cube",
    version: "0.1.0",
    kind: "widget",
    title: "Cube",
    reads: [],
    writes: [],
    capabilities: ["webgl"],
  });
const within = (m: MockSdk, node: ReactNode) => <SdkProvider sdk={m.sdk}>{node}</SdkProvider>;
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

function fakeRenderer() {
  const calls = { render: 0, setSize: 0, dispose: 0, lost: 0, clears: [] as number[] };
  const renderer = {
    render: () => calls.render++,
    setSize: () => calls.setSize++,
    setPixelRatio: () => {},
    setClearColor: (color: Color) => calls.clears.push(color.getHex()),
    dispose: () => calls.dispose++,
    forceContextLoss: () => calls.lost++,
    domElement: document.createElement("canvas"),
  } as unknown as WebGLRenderer;
  return { renderer, calls };
}

test("without webgl the canvas shows a status fallback and never loops, even when the theme changes", async () => {
  let setups = 0;
  const m = mockSdk();
  const { getByRole, queryByRole } = render(
    within(m, <ThreeCanvas label="Cube" createRenderer={() => null} setup={() => void setups++} />),
  );
  expect(m.used).toEqual(["cap:webgl"]);
  expect(getByRole("status").textContent).toBe("Affichage 3D indisponible sur cet appareil.");
  expect(queryByRole("img")).toBeNull();
  expect(setups).toBe(0);
  document.documentElement.classList.toggle("dark");
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(getByRole("status")).toBeTruthy();
  document.documentElement.classList.remove("dark");
});

test("the default factory falls back when the canvas has no webgl context", () => {
  const { getByRole } = render(within(mockSdk(), <ThreeCanvas label="Cube" setup={() => {}} />));
  expect(getByRole("status").textContent).toBe("Affichage 3D indisponible sur cet appareil.");
});

test("with a renderer, setup runs once, a frame is drawn, and unmount disposes everything", async () => {
  const { renderer, calls } = fakeRenderer();
  let setups = 0;
  let cleaned = 0;
  const view = render(
    within(
      mockSdk(),
      <ThreeCanvas
        label="Cube"
        animate={false}
        createRenderer={() => renderer}
        setup={() => {
          setups++;
          return () => void cleaned++;
        }}
      />,
    ),
  );
  expect(view.getByRole("img", { name: "Cube" })).toBeTruthy();
  expect(setups).toBe(1);
  expect(calls.render).toBeGreaterThanOrEqual(1);
  expect(calls.setSize).toBeGreaterThanOrEqual(1);
  expect(calls.clears).toEqual([ZINC_FALLBACK.light.background]);
  document.documentElement.classList.add("dark");
  try {
    await wait(0);
    expect(calls.clears).toEqual([ZINC_FALLBACK.light.background, ZINC_FALLBACK.dark.background]);
  } finally {
    document.documentElement.classList.remove("dark");
  }
  view.unmount();
  expect(cleaned).toBe(1);
  expect(calls.dispose).toBe(1);
  expect(calls.lost).toBe(1);
});

test("an animated canvas calls frame with a bounded dt, pauses when hidden and wakes when shown", async () => {
  const { renderer } = fakeRenderer();
  const dts: number[] = [];
  const m = mockSdk();
  render(
    within(
      m,
      <ThreeCanvas
        label="Cube"
        createRenderer={() => renderer}
        setup={() => {}}
        frame={(_, dt) => void dts.push(dt)}
      />,
    ),
  );
  await waitFor(() => expect(dts.length).toBeGreaterThanOrEqual(2));
  expect(dts[0]).toBe(0);
  expect(dts.every((dt) => dt >= 0 && dt <= 0.1)).toBe(true);
  act(() => m.setVisible(false));
  await wait(40);
  const paused = dts.length;
  await wait(60);
  expect(dts.length).toBe(paused);
  act(() => m.setVisible(true));
  await waitFor(() => expect(dts.length).toBeGreaterThan(paused));
});

test("a paused canvas wakes as soon as animate turns on", async () => {
  const { renderer } = fakeRenderer();
  const dts: number[] = [];
  const m = mockSdk();
  const createRenderer = () => renderer;
  const setup = () => {};
  const frame = (_: unknown, dt: number) => void dts.push(dt);
  const view = render(
    within(
      m,
      <ThreeCanvas
        label="Cube"
        animate={false}
        createRenderer={createRenderer}
        setup={setup}
        frame={frame}
      />,
    ),
  );
  await wait(60);
  expect(dts).toEqual([]);
  view.rerender(
    within(m, <ThreeCanvas label="Cube" createRenderer={createRenderer} setup={setup} frame={frame} />),
  );
  await waitFor(() => expect(dts.length).toBeGreaterThanOrEqual(1));
});
