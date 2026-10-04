import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk, type MockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Component, manifest } from "./index";

runConformance({ manifest, Component });

let queue = new Map<number, FrameRequestCallback>();
let nextId = 1;
const realRaf = globalThis.requestAnimationFrame;
const realCancel = globalThis.cancelAnimationFrame;

beforeEach(() => {
  queue = new Map();
  globalThis.requestAnimationFrame = (cb) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    queue.delete(id);
  };
});

afterEach(() => {
  cleanup();
  globalThis.requestAnimationFrame = realRaf;
  globalThis.cancelAnimationFrame = realCancel;
});

const press = (code: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code }));
  });

const frames = (count: number, from = 1000) =>
  act(() => {
    for (let i = 0; i <= count; i++) {
      const pending = [...queue.values()];
      queue.clear();
      for (const cb of pending) cb(from + i * 17);
    }
  });

async function play(m: MockSdk) {
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const board = await screen.findByRole("img");
  act(() => screen.getByRole("application", { name: "Jeu du serpent" }).focus());
  return board;
}

test("Space starts the game, F asks for the fullscreen, the best score is read", async () => {
  const m = createMockSdk(manifest);
  await m.sdk.data.set("best", 7);
  await play(m);
  const status = screen.getByRole("status");
  await waitFor(() => expect(status.textContent).toContain("Meilleur 7"));
  expect(status.textContent).toContain("Appuie sur Espace pour jouer");
  press("Space");
  expect(status.textContent).toBe("Score 0 · Meilleur 7");
  expect(m.used).toEqual(expect.arrayContaining(["cap:gamepad", "cap:audio", "cap:fullscreen", "data"]));
  press("Space");
  expect(status.textContent).toContain("Pause");
  press("KeyF");
  expect(m.focusRequests).toEqual([true]);
  act(() => m.setFocus(true));
  press("KeyF");
  expect(m.focusRequests).toEqual([true, false]);
});

test("an apple scores and beats the best, a wall ends the game, Space starts again", async () => {
  const random = spyOn(Math, "random").mockReturnValue(148.5 / 277);
  try {
    const m = createMockSdk(manifest);
    const board = await play(m);
    press("Space");
    frames(9);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Score 1 · Meilleur 1");
    expect(board.getAttribute("aria-label")).toBe("Plateau du serpent, score 1");
    await waitFor(() => expect(m.data.get("best")).toBe(1));
    frames(120, 2000);
    expect(status.textContent).toContain("Perdu, Espace pour rejouer");
    const id = board.getAttribute("data-game-id");
    press("Space");
    expect(status.textContent).toBe("Score 0 · Meilleur 1");
    expect(screen.getByRole("img").getAttribute("data-game-id")).toBe(id);
  } finally {
    random.mockRestore();
  }
});

test("the keys only reach the game when it has the focus or fills the window", async () => {
  const m = createMockSdk(manifest);
  render(
    <SdkProvider sdk={m.sdk}>
      <button type="button">Autre widget</button>
      <Component />
    </SdkProvider>,
  );
  await screen.findByRole("img");
  const status = screen.getByRole("status");
  act(() => screen.getByRole("button", { name: "Autre widget" }).focus());
  press("Space");
  press("KeyF");
  expect(status.textContent).toContain("Appuie sur Espace pour jouer");
  expect(m.focusRequests).toEqual([]);
  act(() => screen.getByRole("application", { name: "Jeu du serpent" }).focus());
  press("Space");
  expect(status.textContent).toBe("Score 0 · Meilleur 0");
  act(() => screen.getByRole("button", { name: "Autre widget" }).focus());
  press("Space");
  expect(status.textContent).toBe("Score 0 · Meilleur 0");
  act(() => m.setFocus(true));
  press("Space");
  expect(status.textContent).toContain("Pause");
});
