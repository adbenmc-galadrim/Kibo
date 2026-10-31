import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotFound } from "./NotFound";

afterEach(cleanup);

test("an unknown project says Introuvable and leads back home", async () => {
  let homes = 0;
  render(<NotFound what="project" onHome={() => homes++} />);
  expect(screen.getByRole("heading", { name: "Introuvable" })).toBeTruthy();
  expect(screen.getByText("Ce projet n'existe pas ou a été supprimé.")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Retour à Aujourd'hui" }));
  expect(homes).toBe(1);
});

test("an unknown ticket names what is missing", () => {
  render(<NotFound what="ticket" onHome={() => undefined} />);
  expect(screen.getByText("Ce ticket n'existe pas ou a été supprimé.")).toBeTruthy();
});
