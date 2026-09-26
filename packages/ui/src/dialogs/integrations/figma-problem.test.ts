import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { figmaProblem } from "./figma-problem";

const URL_ = "http://127.0.0.1:3845/mcp";

test("an unreachable server names the address it tried", () => {
  expect(figmaProblem(new KiboError("MCP_UNAVAILABLE", "econnrefused"), URL_)).toEqual({
    tone: "error",
    title: "Serveur Figma injoignable",
    detail: "Rien n'écoute sur 127.0.0.1:3845. Vérifie que Figma est lancé et que le serveur MCP est activé.",
  });
  expect(figmaProblem(null, URL_).title).toBe("Serveur Figma injoignable");
  expect(figmaProblem({ code: "NETWORK", message: "down" }, "pas une url").detail).toMatch(
    /^Rien n'écoute sur pas une url\./,
  );
});

test("missing tools are a warning that lists them", () => {
  expect(
    figmaProblem(new KiboError("MCP_FAILED", "figma server lacks tools: get_metadata, get_screenshot"), URL_),
  ).toEqual({
    tone: "warning",
    title: "Ce serveur n'expose pas les outils Figma attendus",
    detail: "Outils manquants : get_metadata, get_screenshot. Mets Figma à jour.",
  });
  expect(figmaProblem({ code: "MCP_FAILED", message: "boom" }, URL_).detail).toBe(
    "Outils manquants : get_metadata, get_screenshot. Mets Figma à jour.",
  );
});

test("an invalid address and other failures stay readable", () => {
  expect(figmaProblem(new KiboError("INVALID_INPUT", "https only"), URL_)).toEqual({
    tone: "error",
    title: "Adresse invalide",
    detail: "https obligatoire, sauf 127.0.0.1.",
  });
  expect(figmaProblem(new Error("x"), URL_)).toEqual({
    tone: "error",
    title: "Une erreur est survenue.",
    detail: "Error: x",
  });
});
