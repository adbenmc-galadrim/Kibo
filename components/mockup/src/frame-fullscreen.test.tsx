import { expect, mock, test } from "bun:test";
import type { DesignFrame } from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FrameFullscreen, type FullscreenFrame } from "./fullscreen";

const FIGMA = "https://www.figma.com/design/AbC123xyz/Silo?node-id=45-1";
const PENPOT =
  "https://design.penpot.app/#/view/33333333-3333-4333-8333-333333333333?page-id=44444444-4444-4444-8444-444444444444&board-id=55555555-5555-4555-8555-555555555555";

const frameOf = (over: Partial<DesignFrame>): DesignFrame => ({
  id: "figma:AbC123xyz/45:1",
  provider: "figma",
  name: "Conflit de saisie",
  width: 444,
  height: 960,
  url: "http://127.0.0.1/d/1.png",
  mime: "image/png",
  fetchedAt: 0,
  stale: false,
  reachable: true,
  source: FIGMA,
  ...over,
});

const FRAMES: readonly FullscreenFrame[] = [
  { url: FIGMA, frame: frameOf({}) },
  {
    url: PENPOT,
    frame: frameOf({
      id: "penpot:design.penpot.app/home",
      provider: "penpot",
      name: "Accueil",
      url: "http://127.0.0.1/d/2.png",
      source: PENPOT,
      stale: true,
    }),
  },
];
const FIRST = FRAMES.slice(0, 1);
const noop = () => {};

test("the fullscreen view is a dialog named after the frame, with the ticket key, provider and badges", () => {
  render(
    <FrameFullscreen
      open
      frames={FRAMES}
      index={1}
      context="SILO-45"
      onOpenChange={noop}
      onIndexChange={noop}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "Accueil" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(within(dialog).getByText("SILO-45")).toBeTruthy();
  expect(within(dialog).getByText("Penpot")).toBeTruthy();
  expect(within(dialog).getByText("Périmé")).toBeTruthy();
  expect(within(dialog).queryByText("Hors ligne")).toBeNull();
  expect(within(dialog).getByRole("img", { name: "Accueil" })).toBeTruthy();
  expect(within(dialog).getByRole("toolbar", { name: "Zoom" })).toBeTruthy();
  expect(within(dialog).getByText("100 %")).toBeTruthy();
});

test("the view covers the window and describes its keys", () => {
  render(<FrameFullscreen open frames={FRAMES} index={0} onOpenChange={noop} onIndexChange={noop} />);
  const dialog = screen.getByRole("dialog", { name: "Conflit de saisie" });
  expect(dialog.className).toContain("inset-0");
  expect(dialog.className).toContain("h-dvh");
  expect(dialog.className).not.toContain("max-w-lg");
  expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  expect(within(dialog).getByText(/flèches pour changer de cadre, Échap pour quitter/)).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "Fermer" })).toBeNull();
});

test("the exit button is focused at open; it and Escape close the view", async () => {
  const onOpenChange = mock();
  render(<FrameFullscreen open frames={FRAMES} index={0} onOpenChange={onOpenChange} onIndexChange={noop} />);
  const exit = screen.getByRole("button", { name: "Quitter le plein écran (Échap)" });
  await waitFor(() => expect(document.activeElement).toBe(exit));
  fireEvent.click(exit);
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  expect(onOpenChange.mock.calls).toEqual([[false], [false]]);
});

test("closing gives the focus back to the element that opened the view", async () => {
  const view = (open: boolean) => (
    <>
      <button type="button">ouvrir</button>
      <FrameFullscreen open={open} frames={FRAMES} index={0} onOpenChange={noop} onIndexChange={noop} />
    </>
  );
  const { rerender } = render(view(false));
  const opener = screen.getByRole("button", { name: "ouvrir" });
  opener.focus();
  rerender(view(true));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Quitter le plein écran (Échap)" }),
    ),
  );
  rerender(view(false));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

test("arrows and the nav buttons change the frame, bounded; a single frame has no nav", () => {
  const onIndexChange = mock();
  const { rerender } = render(
    <FrameFullscreen open frames={FRAMES} index={0} onOpenChange={noop} onIndexChange={onIndexChange} />,
  );
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("1 / 2")).toBeTruthy();
  fireEvent.keyDown(dialog, { key: "ArrowRight" });
  fireEvent.keyDown(dialog, { key: "ArrowLeft" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cadre suivant" }));
  expect(onIndexChange.mock.calls).toEqual([[1], [1]]);
  rerender(
    <FrameFullscreen open frames={FRAMES} index={1} onOpenChange={noop} onIndexChange={onIndexChange} />,
  );
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
  expect(onIndexChange.mock.calls).toEqual([[1], [1], [0]]);
  rerender(
    <FrameFullscreen open frames={FIRST} index={0} onOpenChange={noop} onIndexChange={onIndexChange} />,
  );
  expect(within(screen.getByRole("dialog")).queryByRole("group", { name: "Cadres" })).toBeNull();
});

test("refresh calls back with the frame url and is disabled while refreshing; open-in links the source", () => {
  const onRefresh = mock();
  const { rerender } = render(
    <FrameFullscreen
      open
      frames={FRAMES}
      index={0}
      onOpenChange={noop}
      onIndexChange={noop}
      onRefresh={onRefresh}
    />,
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Actualiser" }));
  expect(onRefresh.mock.calls).toEqual([[FIGMA]]);
  const open = within(dialog).getByRole("link", { name: "Ouvrir dans Figma" });
  expect(open.getAttribute("href")).toBe(FIGMA);
  expect(open.getAttribute("target")).toBe("_blank");
  expect(open.getAttribute("rel")).toBe("noreferrer noopener");
  rerender(
    <FrameFullscreen
      open
      frames={FRAMES}
      index={0}
      onOpenChange={noop}
      onIndexChange={noop}
      onRefresh={onRefresh}
      refreshing
    />,
  );
  const busy = within(screen.getByRole("dialog")).getByRole("button", { name: "Actualiser" });
  expect(busy.getAttribute("aria-busy")).toBe("true");
  expect(busy.hasAttribute("disabled")).toBe(true);
  rerender(<FrameFullscreen open frames={FRAMES} index={0} onOpenChange={noop} onIndexChange={noop} />);
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Actualiser" })).toBeNull();
});

test("zoom keys reach the viewer, arrows with a modifier or in an input do nothing", () => {
  const onIndexChange = mock();
  render(
    <FrameFullscreen open frames={FRAMES} index={0} onOpenChange={noop} onIndexChange={onIndexChange} />,
  );
  const dialog = screen.getByRole("dialog");
  const viewer = within(dialog).getByRole("group", { name: /^Aperçu de Conflit de saisie/ });
  viewer.focus();
  fireEvent.keyDown(viewer, { key: "+" });
  expect(within(dialog).getByText("125 %")).toBeTruthy();
  fireEvent.keyDown(dialog, { key: "ArrowRight", shiftKey: true });
  fireEvent.keyDown(dialog, { key: "ArrowRight", metaKey: true });
  const input = document.createElement("input");
  dialog.appendChild(input);
  fireEvent.keyDown(input, { key: "ArrowRight" });
  expect(onIndexChange).not.toHaveBeenCalled();
});

test("nothing renders when closed, without frames or with an index out of range", () => {
  const { rerender } = render(
    <FrameFullscreen open={false} frames={FRAMES} index={0} onOpenChange={noop} onIndexChange={noop} />,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(<FrameFullscreen open frames={[]} index={0} onOpenChange={noop} onIndexChange={noop} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(<FrameFullscreen open frames={FRAMES} index={-1} onOpenChange={noop} onIndexChange={noop} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(<FrameFullscreen open frames={FRAMES} index={2} onOpenChange={noop} onIndexChange={noop} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
