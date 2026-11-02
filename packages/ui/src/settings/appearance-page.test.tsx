import { afterEach, beforeEach, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setThemePreference } from "../theme";
import { AppearancePage } from "./AppearancePage";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

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

const inDark = () => {
  setThemePreference("dark");
  render(<AppearancePage />);
  return userEvent.setup();
};

afterEach(() => document.documentElement.removeAttribute("style"));

test("simple mode applies a chosen theme to the whole application", async () => {
  const user = inDark();
  expect(screen.queryByRole("region", { name: "Surfaces" })).toBeNull();
  await user.click(screen.getByRole("button", { name: /^Noir/ }));
  expect(document.documentElement.style.getPropertyValue("--tracking-bg")).toBe("#09090B");
  expect(document.documentElement.style.getPropertyValue("--background")).toBe("#09090B");
  await user.click(screen.getByRole("button", { name: /^Graphite/ }));
  expect(document.documentElement.style.getPropertyValue("--tracking-bg")).toBe("");
});

test("custom mode edits every color from the chosen theme, live", async () => {
  const user = inDark();
  await user.click(screen.getByRole("radio", { name: "Personnalisé" }));
  await user.click(screen.getByRole("button", { name: /^Prune/ }));
  const hex = screen.getByRole("textbox", { name: "Code de la couleur : Fond" });
  expect(hex).toHaveProperty("value", "#17181C");
  await user.clear(hex);
  await user.type(hex, "#101820");
  expect(document.documentElement.style.getPropertyValue("--tracking-bg")).toBe("#101820");
  expect(screen.getAllByRole("textbox", { name: /^Code de la couleur/ })).toHaveLength(17);
  await user.click(screen.getByRole("button", { name: "Revenir au thème" }));
  expect(document.documentElement.style.getPropertyValue("--tracking-bg")).toBe("#17181C");
});

test("a half-typed code changes nothing", async () => {
  const user = inDark();
  await user.click(screen.getByRole("radio", { name: "Personnalisé" }));
  const hex = screen.getByRole("textbox", { name: "Code de la couleur : Fond" });
  await user.clear(hex);
  await user.type(hex, "#12");
  expect(hex.getAttribute("aria-invalid")).toBe("true");
  expect(document.documentElement.style.getPropertyValue("--tracking-bg")).toBe("");
});

test("clicking an element of the preview selects its color, and its tabs switch the view", async () => {
  const user = inDark();
  await user.click(screen.getByRole("radio", { name: "Personnalisé" }));
  const preview = screen.getByRole("region", { name: "Aperçu interactif" });
  await user.click(within(preview).getAllByRole("button", { name: "Carte" })[0] as HTMLElement);
  expect(
    screen.getByRole("textbox", { name: "Code de la couleur : Carte" }).closest("[data-selected]"),
  ).toBeTruthy();
  await user.click(within(preview).getByRole("tab", { name: "Fiche" }));
  await user.click(within(preview).getByRole("button", { name: /^Agents/ }));
  expect(
    screen.getByRole("textbox", { name: "Code de la couleur : Agents" }).closest("[data-selected]"),
  ).toBeTruthy();
});

test("an unreadable color is reported and can be fixed", async () => {
  const user = inDark();
  await user.click(screen.getByRole("radio", { name: "Personnalisé" }));
  expect(screen.getByText("Tout est lisible.")).toBeTruthy();
  const hex = screen.getByRole("textbox", { name: "Code de la couleur : Texte atténué" });
  await user.clear(hex);
  await user.type(hex, "#3A3A3F");
  expect(screen.getByText(/^Texte atténué sur Survol : 1,00:1, sous 4,5:1\.$/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Corriger" }));
  expect(screen.getByText("Tout est lisible.")).toBeTruthy();
});

test("an own theme is created, kept and deleted", async () => {
  const user = inDark();
  await user.click(screen.getByRole("radio", { name: "Personnalisé" }));
  await user.click(screen.getByRole("button", { name: "Nouveau thème" }));
  expect(screen.getByRole("button", { name: "Enregistrer" })).toHaveProperty("disabled", true);
  await user.type(screen.getByRole("textbox", { name: "Nom du thème" }), "Mon thème");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(screen.getByRole("button", { name: /^Mon thème/ }).getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Supprimer le thème Mon thème" }));
  expect(screen.queryByRole("button", { name: /^Mon thème/ })).toBeNull();
  expect(screen.getByRole("button", { name: /^Graphite/ }).getAttribute("aria-pressed")).toBe("true");
});
