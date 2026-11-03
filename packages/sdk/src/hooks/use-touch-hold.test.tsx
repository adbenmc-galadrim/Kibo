import { expect, spyOn, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { useTouchDevice } from "./use-touch-device";
import { useTouchHold } from "./use-touch-hold";

function Card({ onHold, onClick }: { onHold(): void; onClick(): void }) {
  const hold = useTouchHold(onHold, 40);
  return (
    <button type="button" {...hold} onClick={onClick}>
      SILO-45
    </button>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("a still finger held long enough fires the hold and swallows the click of the release", async () => {
  const held: string[] = [];
  render(<Card onHold={() => held.push("hold")} onClick={() => held.push("click")} />);
  const card = screen.getByRole("button");
  fireEvent.pointerDown(card, { pointerType: "touch", clientX: 10, clientY: 10 });
  await wait(60);
  fireEvent.pointerUp(card, { pointerType: "touch" });
  fireEvent.click(card);
  expect(held).toEqual(["hold"]);
});

test("a finger that moves, a short tap or a mouse never fires the hold", async () => {
  const held: string[] = [];
  render(<Card onHold={() => held.push("hold")} onClick={() => undefined} />);
  const card = screen.getByRole("button");
  fireEvent.pointerDown(card, { pointerType: "touch", clientX: 10, clientY: 10 });
  fireEvent.pointerMove(card, { pointerType: "touch", clientX: 30, clientY: 10 });
  await wait(60);
  fireEvent.pointerDown(card, { pointerType: "touch", clientX: 10, clientY: 10 });
  fireEvent.pointerUp(card, { pointerType: "touch" });
  fireEvent.pointerDown(card, { pointerType: "mouse", clientX: 10, clientY: 10 });
  await wait(60);
  expect(held).toEqual([]);
});

function Probe() {
  return <span>{useTouchDevice() ? "doigt" : "souris"}</span>;
}

test("a coarse pointer is a touch device", () => {
  const media = spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({ matches: query === "(pointer: coarse)", media: query, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList,
  );
  render(<Probe />);
  expect(screen.getByText("doigt")).toBeTruthy();
  media.mockRestore();
});
