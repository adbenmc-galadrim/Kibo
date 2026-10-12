import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { type ProjectCommand, Question } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo, seedQuestions } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Component, manifest } from "./index";

const OPEN = "Garder l'ordre des sous-tickets par index fractionnaire ?";
const ANSWERED = "Refuser les hooks d'un processus mort ?";
const ARCHIVED = "Une question rangée ?";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = seedDemo(run);
  seedQuestions(run, [ids["KIB-12"] ?? "", ids["KIB-14"] ?? ""]);
  const q = Question.parse(
    run({
      method: "createQuestion",
      ticketId: ids["KIB-9"] ?? "",
      title: ARCHIVED,
      createdBy: { kind: "human", ref: "adam" },
    }),
  );
  run({ method: "archiveQuestion", questionId: q.id, by: { kind: "human", ref: "adam" } });
};

const scrolls: ScrollIntoViewOptions[] = [];
const realMatchMedia = window.matchMedia;
const realScroll = HTMLElement.prototype.scrollIntoView;

const reduceMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  scrolls.length = 0;
  HTMLElement.prototype.scrollIntoView = mock(function record(opts?: boolean | ScrollIntoViewOptions) {
    if (typeof opts === "object") scrolls.push(opts);
  });
  reduceMotion(false);
});

afterEach(() => {
  HTMLElement.prototype.scrollIntoView = realScroll;
  window.matchMedia = realMatchMedia;
});

const mount = () => {
  const m = createMockSdk(manifest, { seed, surface: "view" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const idOf = (m: ReturnType<typeof mount>, title: string) =>
  m.snapshot().questions.find((q) => q.title === title)?.id ?? "";

test("a target scrolls its card to the center, focuses it and lights it for 1.5 s", async () => {
  const m = mount();
  const card = await screen.findByRole("article", { name: OPEN });
  act(() => m.setSpotlight({ kind: "question", id: idOf(m, OPEN) }));
  await waitFor(() => expect(card.getAttribute("data-spotlight")).toBe("bounce"));
  expect(scrolls).toEqual([{ block: "center", behavior: "smooth" }]);
  expect(document.activeElement).toBe(card);
  await waitFor(() => expect(card.hasAttribute("data-spotlight")).toBe(false), { timeout: 2500 });
});

test("reduced motion fades only, without a smooth scroll", async () => {
  reduceMotion(true);
  const m = mount();
  const card = await screen.findByRole("article", { name: OPEN });
  act(() => m.setSpotlight({ kind: "question", id: idOf(m, OPEN) }));
  await waitFor(() => expect(card.getAttribute("data-spotlight")).toBe("fade"));
  expect(scrolls).toEqual([{ block: "center", behavior: "auto" }]);
});

test("a hidden target opens the filters: « Toutes » for an answer, « Archivées » for an archive", async () => {
  const m = mount();
  await screen.findByRole("article", { name: OPEN });
  expect(screen.queryByRole("article", { name: ANSWERED })).toBeNull();
  act(() => m.setSpotlight({ kind: "question", id: idOf(m, ANSWERED) }));
  const answered = await screen.findByRole("article", { name: ANSWERED });
  expect(screen.getByRole("radio", { name: "Toutes" }).getAttribute("aria-checked")).toBe("true");
  await waitFor(() => expect(answered.hasAttribute("data-spotlight")).toBe(true));
  act(() => m.setSpotlight({ kind: "question", id: idOf(m, ARCHIVED) }));
  const archived = await screen.findByRole("article", { name: ARCHIVED });
  expect(screen.getByRole("radio", { name: "Archivées" }).getAttribute("aria-checked")).toBe("true");
  await waitFor(() => expect(archived.hasAttribute("data-spotlight")).toBe(true));
});

test("an unknown target does nothing, the same target plays once", async () => {
  const m = mount();
  const card = await screen.findByRole("article", { name: OPEN });
  act(() => m.setSpotlight({ kind: "question", id: "inconnue" }));
  expect(scrolls).toEqual([]);
  const id = idOf(m, OPEN);
  act(() => m.setSpotlight({ kind: "question", id }));
  await waitFor(() => expect(scrolls).toHaveLength(1));
  act(() => m.setSpotlight(null));
  act(() => m.setSpotlight({ kind: "question", id }));
  await new Promise((r) => setTimeout(r, 20));
  expect(scrolls).toHaveLength(1);
  expect(card.tabIndex).toBe(-1);
});
