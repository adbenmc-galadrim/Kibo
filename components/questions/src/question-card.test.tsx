import { afterEach, expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import { fr } from "./fr";
import { Component, manifest } from "./index";

afterEach(cleanup);

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = seedDemo(run);
  run({
    method: "createQuestion",
    ticketId: ids["KIB-12"] ?? "",
    title: "Garder ce format ?",
    blocking: true,
    provisional: "Oui",
    createdBy: { kind: "human", ref: "lea" },
  });
};

const blockingCard = async () => {
  render(
    <SdkProvider sdk={createMockSdk(manifest, { seed, surface: "view" }).sdk}>
      <Component />
    </SdkProvider>,
  );
  return screen.findByRole("article", { name: /Garder ce format/ });
};

test("a blocking question has no red border and a neutral paste button", async () => {
  const card = await blockingCard();
  expect(card.className).not.toContain("border-destructive");
  const paste = within(card).getByRole("button", { name: "Coller la réponse" });
  expect(paste.dataset.variant).toBe("outline");
  expect(paste.className).not.toContain("orange");
});

test("only the blocking pill stays red on a blocking question", async () => {
  const card = await blockingCard();
  const red = Array.from(card.querySelectorAll("*")).filter(
    (el) => el.classList.contains("text-destructive") || el.classList.contains("border-destructive"),
  );
  expect(red.map((el) => el.textContent)).toEqual([fr.blocking]);
});

test("confirming a provisional answer is a neutral button", async () => {
  const card = await blockingCard();
  const confirm = within(card).getByRole("button", { name: "Valider le choix provisoire" });
  expect(confirm.className).not.toContain("orange");
});
