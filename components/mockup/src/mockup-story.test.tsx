import { expect, test } from "bun:test";
import { EMBED_ATTRIBUTES, type StorybookOrigin, storyUrlWithOrigin } from "@kibo/schema";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fr } from "./fr";
import {
  FIGMA,
  FIGMA_FRAME,
  mountFrames,
  openMenu,
  problemText,
  STORY,
  STORY_FRAME,
  STORY_NAME,
  WORKTREE_STORY,
} from "./mockup.test-helper";

const PROJECT: StorybookOrigin = {
  origin: "http://localhost:6006",
  label: "Projet",
  branch: null,
  path: null,
  reachable: true,
};
const FEAT_X: StorybookOrigin = {
  origin: "http://localhost:6007",
  label: "feat/x",
  branch: "feat/x",
  path: "/repo/.worktrees/feat-x",
  reachable: false,
};

test("a story renders in an iframe with the Storybook header and no image", async () => {
  const { m } = mountFrames([STORY]);
  const frame = await screen.findByTitle(STORY_NAME);
  expect(frame.tagName).toBe("IFRAME");
  expect(frame.getAttribute("src")).toBe("about:blank#story-1");
  expect(frame.getAttribute("sandbox")).toBe(EMBED_ATTRIBUTES.storybook.sandbox);
  expect(frame.getAttribute("allow")).toBe(EMBED_ATTRIBUTES.storybook.allow);
  expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Storybook")).toBeTruthy();
  expect(screen.getByRole("link", { name: fr.open("storybook") }).getAttribute("href")).toBe(
    "http://localhost:6006/?path=/story/screens-home--default",
  );
  expect(screen.queryByText(fr.stale)).toBeNull();
  expect(screen.queryByText(fr.offline)).toBeNull();
  expect(screen.getByText(fr.noLinkedStory)).toBeTruthy();
  expect(m.used).toContain("cap:design");
  expect(m.violations).toEqual([]);
  cleanup();
});

test("an unreachable Storybook says how to start it and retries with a refresh", async () => {
  const { asked } = mountFrames([STORY], {
    frames: [{ ...STORY_FRAME, error: "REMOTE_UNAVAILABLE" }],
  });
  expect(await problemText("alert")).toBe(
    "Storybook injoignable (localhost:6006). Lance-le (pnpm storybook), puis réessaie.",
  );
  fireEvent.click(screen.getByRole("button", { name: fr.retry }));
  await waitFor(() => expect(asked).toHaveLength(2));
  cleanup();
});

test("story problems name the Storybook host", async () => {
  mountFrames([STORY], { frames: [{ ...STORY_FRAME, error: "INVALID_INPUT" }] });
  expect(await problemText("alert")).toBe(
    "Ce Storybook (localhost:6006) n'est pas déclaré dans le projet : Modifier le projet › Storybook.",
  );
  cleanup();
  mountFrames([STORY], { frames: [{ ...STORY_FRAME, error: "REMOTE_NOT_FOUND" }] });
  expect(await problemText("alert")).toBe("Story introuvable dans ce Storybook : vérifie son identifiant.");
  cleanup();
});

test("the origin menu swaps the story origin without writing the config", async () => {
  const { m, asked } = mountFrames([STORY], {
    storybooks: [PROJECT, FEAT_X],
    frames: [STORY_FRAME, { url: WORKTREE_STORY, name: "Accueil feat/x", html: true }],
  });
  await screen.findByTitle(STORY_NAME);
  const trigger = await screen.findByRole("button", { name: "Storybook : Projet" });
  openMenu(trigger);
  const menu = await screen.findByRole("menu");
  const items = within(menu).getAllByRole("menuitemradio");
  expect(items).toHaveLength(2);
  expect(items[1]?.textContent).toContain(fr.origins.unreachable);
  fireEvent.click(within(menu).getByRole("menuitemradio", { name: /feat\/x/ }));
  expect(await screen.findByTitle("Accueil feat/x")).toBeTruthy();
  expect(asked.at(-1)).toBe(storyUrlWithOrigin(STORY, FEAT_X.origin) ?? "");
  expect(asked.at(-1)).toBe(WORKTREE_STORY);
  expect(screen.getByRole("button", { name: "Storybook : feat/x" })).toBeTruthy();
  expect(m.configPatches).toEqual([]);
  cleanup();
});

test("one origin, or an image frame, shows no origin menu", async () => {
  mountFrames([STORY], { storybooks: [PROJECT] });
  await screen.findByTitle(STORY_NAME);
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Storybook :/ })).toBeNull());
  cleanup();
  const { m } = mountFrames([FIGMA], { storybooks: [PROJECT, FEAT_X], frames: [FIGMA_FRAME] });
  await screen.findByRole("img", { name: "Tickets" });
  expect(screen.queryByRole("button", { name: /^Storybook :/ })).toBeNull();
  expect(m.violations).toEqual([]);
  cleanup();
});
