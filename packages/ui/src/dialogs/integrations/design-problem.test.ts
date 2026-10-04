import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { connectProblem } from "./design-problem";

const MCP_URL = "http://127.0.0.1:3845/mcp";

test("a refused token is an error for both providers", () => {
  expect(connectProblem("figma-token", new KiboError("REMOTE_REJECTED", "figma 403"), "")).toEqual({
    tone: "error",
    title: "Jeton refusé",
    detail: "Vérifie le jeton et ses portées, puis réessaie.",
    field: "token",
  });
  expect(connectProblem("penpot", { code: "REMOTE_REJECTED", message: "401" }, "").title).toBe(
    "Jeton refusé",
  );
});

test("an unreachable provider names the address it tried", () => {
  expect(
    connectProblem("penpot", new KiboError("REMOTE_UNAVAILABLE", "econnrefused"), "http://localhost:9010"),
  ).toEqual({
    tone: "error",
    title: "Instance injoignable",
    detail: "Rien ne répond sur localhost:9010. Vérifie l'adresse et que l'instance est démarrée.",
    field: "address",
  });
  expect(connectProblem("figma-mcp", new KiboError("MCP_UNAVAILABLE", "down"), MCP_URL)).toEqual({
    tone: "error",
    title: "Serveur Figma injoignable",
    detail: "Rien n'écoute sur 127.0.0.1:3845. Vérifie que Figma est lancé et que le serveur MCP est activé.",
    field: "address",
  });
  expect(connectProblem("figma-mcp", null, "pas une url").detail).toMatch(/^Rien n'écoute sur pas une url\./);
});

test("an unreachable figma api does not mention the mcp server", () => {
  expect(
    connectProblem("figma-token", new KiboError("REMOTE_UNAVAILABLE", "down"), "https://api.figma.com"),
  ).toEqual({
    tone: "error",
    title: "Figma injoignable",
    detail: "Impossible de joindre api.figma.com. Vérifie ta connexion internet, puis réessaie.",
    field: null,
  });
});

test("missing figma tools are a warning that lists them", () => {
  expect(
    connectProblem(
      "figma-mcp",
      new KiboError("MCP_FAILED", "figma server lacks tools: get_screenshot"),
      MCP_URL,
    ),
  ).toEqual({
    tone: "warning",
    title: "Ce serveur n'expose pas les outils Figma attendus",
    detail: "Outils manquants : get_screenshot. Mets Figma à jour.",
    field: "address",
  });
  expect(connectProblem("figma-mcp", { code: "MCP_FAILED", message: "boom" }, MCP_URL).detail).toBe(
    "Outils manquants : get_metadata, get_screenshot. Mets Figma à jour.",
  );
});

test("a locked keychain, an invalid address and other failures stay readable", () => {
  expect(connectProblem("penpot", new KiboError("SECRET_STORE_UNAVAILABLE", "locked"), "")).toEqual({
    tone: "error",
    title:
      "Trousseau système indisponible : déverrouille-le (Secret Service sur Linux) puis réessaie. Kibo ne stocke jamais de secret en clair.",
    detail: "",
    field: null,
  });
  expect(connectProblem("figma-mcp", new KiboError("INVALID_INPUT", "https only"), MCP_URL)).toEqual({
    tone: "error",
    title: "Adresse invalide",
    detail: "https obligatoire, sauf 127.0.0.1 ou localhost.",
    field: "address",
  });
  expect(connectProblem("figma-mcp", new Error("x"), MCP_URL)).toEqual({
    tone: "error",
    title: "Une erreur est survenue.",
    detail: "Error: x",
    field: null,
  });
});
