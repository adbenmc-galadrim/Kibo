import { afterEach, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { usePanelDock } from "./use-panel-dock";

const original = window.matchMedia;
const root = document.documentElement.style;

function narrowScreen(matches: boolean) {
  window.matchMedia = (media: string): MediaQueryList =>
    Object.assign(new EventTarget(), {
      matches,
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    });
}

afterEach(() => {
  cleanup();
  window.matchMedia = original;
});

function Probe({ open }: { open: boolean }) {
  const { overlay } = usePanelDock(open, 340);
  return <span data-overlay={overlay} />;
}

test("on a wide screen the open panel docks: content and toasts make room", () => {
  narrowScreen(false);
  const { container, unmount } = render(<Probe open />);
  expect(container.querySelector("span")?.dataset.overlay).toBe("false");
  expect(root.getPropertyValue("--project-agent-w")).toBe("341px");
  expect(root.getPropertyValue("--project-agent-edge")).toBe("341px");
  unmount();
  expect(root.getPropertyValue("--project-agent-w")).toBe("");
  expect(root.getPropertyValue("--project-agent-edge")).toBe("");
});

test("under 1180 px the panel covers the content without squeezing it; toasts still avoid it", () => {
  narrowScreen(true);
  const { container } = render(<Probe open />);
  expect(container.querySelector("span")?.dataset.overlay).toBe("true");
  expect(root.getPropertyValue("--project-agent-w")).toBe("");
  expect(root.getPropertyValue("--project-agent-edge")).toBe("341px");
});

test("a closed panel takes no room", () => {
  narrowScreen(false);
  render(<Probe open={false} />);
  expect(root.getPropertyValue("--project-agent-w")).toBe("");
  expect(root.getPropertyValue("--project-agent-edge")).toBe("");
});
