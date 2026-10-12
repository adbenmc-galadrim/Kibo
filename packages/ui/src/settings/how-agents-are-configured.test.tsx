import { beforeEach, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HowAgentsAreConfigured } from "./HowAgentsAreConfigured";

beforeEach(() => localStorage.clear());

const toggle = () => screen.getByRole("button", { name: "Comment les agents sont configurés" });

test("the explanation is open the first time, with the order and the links to agents and skills", () => {
  render(<HowAgentsAreConfigured />);
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  const steps = screen.getByRole("list", { name: "Ordre d'injection" });
  expect(steps.textContent).toContain("Workspace");
  expect(steps.textContent).toContain("Profil de l'agent : spec et skills");
  expect(screen.getByText(/Chaque agent reçoit, dans cet ordre/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ouvrir la page Agents →" }).getAttribute("href")).toBe("#/agents");
  expect(screen.getByRole("link", { name: "Skills →" }).getAttribute("href")).toBe("#/agents/skills");
});

test("folding it is remembered and shows the short order", async () => {
  const { unmount } = render(<HowAgentsAreConfigured />);
  await userEvent.setup().click(toggle());
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByText("workspace → projet → domaine → profil de l'agent")).toBeTruthy();
  unmount();
  render(<HowAgentsAreConfigured />);
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link", { name: "Skills →" })).toBeNull();
});
