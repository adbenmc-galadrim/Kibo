import { SdkProvider } from "@kibo/sdk";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk, type MockFrame, type MockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Component, manifest } from "./index";

export const FIGMA = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
export const STORY = "http://localhost:6006/iframe.html?id=screens-home--default&viewMode=story";
export const WORKTREE_STORY = "http://localhost:6007/iframe.html?id=screens-home--default&viewMode=story";
export const STORY_NAME = "Écrans / Accueil";

export const STORY_FRAME: MockFrame = { url: STORY, name: STORY_NAME, html: true };
export const FIGMA_FRAME: MockFrame = { url: FIGMA, name: "Tickets", width: 1440, height: 900 };

export type Mounted = { m: MockSdk; asked: string[] };

export function mountFrames(frame: unknown, opts: Partial<MockSdkOptions> = {}): Mounted {
  const m = createMockSdk(manifest, {
    config: { frame, fit: "contain" },
    frames: [STORY_FRAME, FIGMA_FRAME],
    seed: seedDemo,
    ...opts,
  });
  const asked: string[] = [];
  const frameOf = m.sdk.design.frame;
  m.sdk.design.frame = (url, o) => {
    asked.push(url);
    return frameOf(url, o);
  };
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return { m, asked };
}

export const problemText = (role: "status" | "alert") =>
  waitFor(() => {
    const text = screen.getByRole(role).querySelector("p")?.textContent;
    if (text === undefined) throw new Error("no problem shown yet");
    return text;
  });

export function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
}
