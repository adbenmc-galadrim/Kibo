import { afterEach, beforeEach, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppearancePage } from "./AppearancePage";

beforeEach(() => localStorage.clear());
afterEach(() => document.documentElement.classList.remove("dark"));

test("the theme segment reflects and sets the preference (screen 110)", async () => {
  render(<AppearancePage />);
  expect(screen.getByRole("heading", { level: 1, name: "Apparence" })).toBeTruthy();
  expect(screen.getByText("Le thème système suit les réglages de ton ordinateur.")).toBeTruthy();
  const group = screen.getByRole("radiogroup", { name: "Thème" });
  expect(screen.getByRole("radio", { name: "Système" }).getAttribute("aria-checked")).toBe("true");
  await userEvent.setup().click(screen.getByRole("radio", { name: "Sombre" }));
  expect(screen.getByRole("radio", { name: "Sombre" }).getAttribute("aria-checked")).toBe("true");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("kibo.theme")).toBe("dark");
  expect(group.querySelectorAll("[role=radio]")).toHaveLength(3);
  expect(screen.queryByText("Accès web")).toBeNull();
});
