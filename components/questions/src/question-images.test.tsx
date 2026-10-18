import { expect, test } from "bun:test";
import { Question } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { manifest } from "./index";
import { QuestionImages } from "./QuestionImages";

const IMAGES = [
  { id: "i1", name: "1-no-access.png", bytes: 1200, width: 1440, height: 900 },
  { id: "i2", name: "2-list.png", bytes: 900, width: null, height: null },
];

const question = (images: typeof IMAGES) =>
  Question.parse({
    id: "q1",
    ticketId: "t1",
    runId: "r1",
    title: "Valider l'écran 1.2 ?",
    context: "",
    options: ["Valider", "Demander une correction"],
    provisional: null,
    blocking: true,
    createdBy: { kind: "agent", ref: "silo-livraison" },
    createdAt: 1,
    answer: null,
    kind: "validation",
    images,
  });

const mount = (q: Question) => {
  const { sdk } = createMockSdk(manifest, { surface: "view" });
  const view = render(
    <SdkProvider sdk={sdk}>
      <QuestionImages question={q} />
    </SdkProvider>,
  );
  return { sdk, view };
};

test("each image of a question is a thumbnail served by the daemon, named by its file", () => {
  const { sdk } = mount(question(IMAGES));
  const shown = within(screen.getByRole("list", { name: "Captures · 2" })).getAllByRole("img");
  expect(shown.map((img) => img.getAttribute("alt"))).toEqual(["1-no-access.png", "2-list.png"]);
  expect(shown.map((img) => img.getAttribute("src"))).toEqual([
    sdk.questions.imageUrl("q1", "i1"),
    sdk.questions.imageUrl("q1", "i2"),
  ]);
  expect(shown[0]?.getAttribute("width")).toBe("1440");
  expect(shown.every((img) => img.getAttribute("loading") === "lazy")).toBe(true);
  expect(screen.getByRole("list", { name: "Captures · 2" })).toBeTruthy();
  expect(document.body.innerHTML).not.toContain("/Users");
});

test("a question without image renders nothing", () => {
  const { view } = mount(question([]));
  expect(view.container.innerHTML).toBe("");
});

test("a thumbnail opens the full-frame viewer, arrows move between images, Escape closes it", async () => {
  const { sdk } = mount(question(IMAGES));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agrandir 1-no-access.png" }));
  const viewer = await screen.findByRole("dialog", { name: "1-no-access.png" });
  expect(within(viewer).getByText("1 / 2")).toBeTruthy();
  expect(within(viewer).getByRole("img", { name: "1-no-access.png" }).getAttribute("src")).toBe(
    sdk.questions.imageUrl("q1", "i1"),
  );
  expect(within(viewer).getByRole("button", { name: "Image précédente" }).hasAttribute("disabled")).toBe(
    true,
  );
  await user.keyboard("{ArrowRight}");
  const next = await screen.findByRole("dialog", { name: "2-list.png" });
  expect(within(next).getByText("2 / 2")).toBeTruthy();
  expect(within(next).getByRole("button", { name: "Image suivante" }).hasAttribute("disabled")).toBe(true);
  await user.click(within(next).getByRole("button", { name: "Image précédente" }));
  expect(await screen.findByRole("dialog", { name: "1-no-access.png" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
