import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { failureText, integrationErrorText, remoteErrorText } from "./remote-error";

test("a github answer is stated in French with its status", () => {
  expect(remoteErrorText("REMOTE_REJECTED", "github 422: Validation Failed: label design unknown")).toBe(
    "GitHub a répondu 422 : validation refusée (label design unknown)",
  );
  expect(remoteErrorText("REMOTE_REJECTED", "github 401: Bad credentials")).toBe(
    "GitHub a répondu 401 : reconnecte ton compte",
  );
  expect(remoteErrorText("REMOTE_UNAVAILABLE", "github 502")).toBe("GitHub a répondu 502");
});

test("other remote failures fall back on their code", () => {
  expect(remoteErrorText("RATE_LIMITED", "rate limited")).toBe("Limite GitHub atteinte");
  expect(remoteErrorText("REMOTE_UNAVAILABLE", "fetch failed")).toBe("GitHub injoignable");
  expect(remoteErrorText("NOT_CONNECTED", "github account not connected")).toBe(
    "Compte GitHub non connecté : reconnecte ton compte",
  );
  expect(remoteErrorText("INTERNAL", "boom")).toBe("Une erreur est survenue.");
  expect(failureText(new KiboError("TIMEOUT", "timed out"))).toBe("Délai dépassé");
  expect(failureText(new Error("boom"))).toBe("Une erreur est survenue.");
});

test("integration rows explain their error in French", () => {
  expect(integrationErrorText("mcp", { code: "MCP_UNAVAILABLE", message: "sentry-staging" })).toBe(
    "Serveur sentry-staging injoignable",
  );
  expect(integrationErrorText("mcp", { code: "MCP_UNAVAILABLE", message: "a, b" })).toBe(
    "Serveurs a, b injoignables",
  );
  expect(integrationErrorText("figma", { code: "MCP_UNAVAILABLE", message: "connect ECONNREFUSED" })).toBe(
    "Serveur Figma injoignable",
  );
  expect(integrationErrorText("git", { code: "NOT_FOUND", message: "git introuvable" })).toBe(
    "git introuvable",
  );
  expect(integrationErrorText("github", { code: "SECRET_STORE_UNAVAILABLE", message: "keychain busy" })).toBe(
    "Trousseau système indisponible",
  );
  expect(
    integrationErrorText("github", {
      code: "NOT_CONNECTED",
      message: "github token missing from the keychain",
    }),
  ).toBe("Compte GitHub non connecté : reconnecte ton compte");
});
