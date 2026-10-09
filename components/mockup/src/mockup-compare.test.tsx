import { expect, test } from "bun:test";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fr } from "./fr";
import {
  FIGMA,
  FIGMA_FRAME,
  mountFrames,
  openMenu,
  STORY,
  STORY_FRAME,
  STORY_NAME,
} from "./mockup.test-helper";

const BROKEN = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=56-78";
const OTHER = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=90-12";

const surfaceOf = (el: HTMLElement): HTMLElement => {
  const parent = el.parentElement;
  if (!parent) throw new Error("surface not found");
  return parent;
};
const storySurface = async () => surfaceOf(await screen.findByTitle(STORY_NAME));
const imageSurface = async () => surfaceOf(await screen.findByRole("img", { name: "Tickets" }));
const compareButton = () => screen.queryByRole("button", { name: fr.compare.open });

test("Comparer shows on a story only when the list has an image frame", async () => {
  mountFrames([STORY, FIGMA]);
  await screen.findByTitle(STORY_NAME);
  expect(compareButton()).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cadre suivant" }));
  await screen.findByRole("img", { name: "Tickets" });
  expect(compareButton()).toBeNull();
  cleanup();
  mountFrames([STORY]);
  await screen.findByTitle(STORY_NAME);
  expect(compareButton()).toBeNull();
  cleanup();
});

test("side by side shows both surfaces at the mockup size", async () => {
  const { m } = mountFrames([STORY, FIGMA]);
  await screen.findByTitle(STORY_NAME);
  fireEvent.click(compareButton() ?? document.body);
  const bar = await screen.findByRole("group", { name: fr.compare.bar });
  expect(await within(bar).findByRole("button", { name: "Référence : Tickets" })).toBeTruthy();
  const story = await storySurface();
  const image = await imageSurface();
  expect(story.style.width).toBe("1440px");
  expect(story.style.height).toBe("900px");
  expect(image.style.width).toBe("1440px");
  expect(story.style.transform).toBe(image.style.transform);
  expect(story.parentElement?.nextElementSibling?.contains(image)).toBe(true);
  expect(image.style.pointerEvents).toBe("");
  expect(screen.queryByRole("slider", { name: "Maquette" })).toBeNull();
  expect(m.configPatches).toEqual([]);
  cleanup();
});

test("overlay lays the mockup over the story with opacity and wipe", async () => {
  mountFrames([STORY, FIGMA]);
  await screen.findByTitle(STORY_NAME);
  fireEvent.click(compareButton() ?? document.body);
  fireEvent.click(await screen.findByRole("radio", { name: fr.compare.overlay }));
  const opacity = await screen.findByRole("slider", { name: "Maquette" });
  expect(opacity.getAttribute("type")).toBe("range");
  expect((opacity as HTMLInputElement).value).toBe("50");
  expect(screen.getByText("Maquette 50 %")).toBeTruthy();
  const image = await imageSurface();
  const story = await storySurface();
  expect(image.style.opacity).toBe("0.5");
  expect(image.style.pointerEvents).toBe("none");
  expect(image.style.clipPath).toBe("inset(0 0% 0 0)");
  expect(story.style.pointerEvents).toBe("");
  expect(story.nextElementSibling).toBe(image);
  fireEvent.change(screen.getByRole("slider", { name: fr.compare.wipe }), { target: { value: "40" } });
  await waitFor(() => expect(image.style.clipPath).toBe("inset(0 60% 0 0)"));
  fireEvent.change(opacity, { target: { value: "80" } });
  await waitFor(() => expect(image.style.opacity).toBe("0.8"));
  fireEvent.click(screen.getByRole("button", { name: fr.compare.swap }));
  const swapped = await storySurface();
  await waitFor(() => expect(swapped.style.opacity).toBe("0.8"));
  expect((await imageSurface()).nextElementSibling).toBe(swapped);
  expect(screen.getByRole("slider", { name: "Story" })).toBeTruthy();
  cleanup();
});

test("swap exchanges left and right, close removes the bar", async () => {
  mountFrames([STORY, FIGMA]);
  await screen.findByTitle(STORY_NAME);
  fireEvent.click(compareButton() ?? document.body);
  await imageSurface();
  fireEvent.click(screen.getByRole("button", { name: fr.compare.swap }));
  const image = await imageSurface();
  await waitFor(async () =>
    expect(image.parentElement?.nextElementSibling?.contains(await storySurface())).toBe(true),
  );
  fireEvent.click(screen.getByRole("button", { name: fr.compare.close }));
  await waitFor(() => expect(screen.queryByRole("group", { name: fr.compare.bar })).toBeNull());
  expect(screen.queryByRole("img", { name: "Tickets" })).toBeNull();
  cleanup();
});

test("changing the current frame closes the comparison", async () => {
  mountFrames([STORY, FIGMA]);
  await screen.findByTitle(STORY_NAME);
  fireEvent.click(compareButton() ?? document.body);
  await screen.findByRole("group", { name: fr.compare.bar });
  fireEvent.click(screen.getByRole("button", { name: "Cadre suivant" }));
  await screen.findByRole("img", { name: "Tickets" });
  fireEvent.click(screen.getByRole("button", { name: "Cadre précédent" }));
  await screen.findByTitle(STORY_NAME);
  expect(screen.queryByRole("group", { name: fr.compare.bar })).toBeNull();
  expect(screen.queryByRole("img", { name: "Tickets" })).toBeNull();
  cleanup();
});

test("a mockup that fails to load is not offered and the next one is used", async () => {
  mountFrames([STORY, BROKEN, OTHER], {
    frames: [
      STORY_FRAME,
      { url: BROKEN, name: "Cassé", error: "REMOTE_NOT_FOUND" },
      { ...FIGMA_FRAME, url: OTHER },
    ],
  });
  await screen.findByTitle(STORY_NAME);
  fireEvent.click(compareButton() ?? document.body);
  expect(await screen.findByRole("img", { name: "Tickets" })).toBeTruthy();
  const trigger = screen.getByRole("button", { name: "Référence : Tickets" });
  openMenu(trigger);
  const items = within(await screen.findByRole("menu")).getAllByRole("menuitemradio");
  expect(items.map((i) => i.textContent)).toEqual(["Tickets"]);
  cleanup();
});

test("the reference menu switches the mockup", async () => {
  mountFrames([STORY, FIGMA, OTHER], {
    frames: [STORY_FRAME, FIGMA_FRAME, { url: OTHER, name: "Réglages", width: 800, height: 600 }],
  });
  await screen.findByTitle(STORY_NAME);
  fireEvent.click(compareButton() ?? document.body);
  openMenu(await screen.findByRole("button", { name: "Référence : Tickets" }));
  const menu = await screen.findByRole("menu");
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .map((i) => i.textContent),
  ).toEqual(["Tickets", "Cadre 3 (Figma)"]);
  fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Cadre 3 (Figma)" }));
  const image = surfaceOf(await screen.findByRole("img", { name: "Réglages" }));
  await waitFor(async () => expect((await storySurface()).style.width).toBe("800px"));
  expect(image.style.height).toBe("600px");
  expect(screen.getByRole("button", { name: "Référence : Réglages" })).toBeTruthy();
  cleanup();
});
