import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { failureOf, syncErrorText } from "./sync-error-text";

const ctx = { repo: "adam/kibo", resumeAt: null };

test("github statuses are explained in French, never with the raw english detail", () => {
  expect(syncErrorText({ code: "REMOTE_NOT_FOUND", message: "github 404: Not Found" }, ctx)).toBe(
    "GitHub a répondu 404, dépôt adam/kibo introuvable pour ce compte.",
  );
  expect(syncErrorText({ code: "REMOTE_REJECTED", message: "github 401: Bad credentials" }, ctx)).toBe(
    "GitHub a répondu 401, connexion GitHub expirée : reconnecte GitHub dans Paramètres › Intégrations.",
  );
  expect(
    syncErrorText({ code: "REMOTE_REJECTED", message: "github 403: Resource not accessible" }, ctx),
  ).toBe("GitHub a répondu 403, accès refusé à adam/kibo : vérifie les portées du jeton (repo, project).");
  expect(syncErrorText({ code: "REMOTE_REJECTED", message: "github 422: Validation Failed" }, ctx)).toBe(
    "GitHub a répondu 422, données refusées par GitHub.",
  );
  expect(syncErrorText({ code: "REMOTE_REJECTED", message: "github 400: Problems parsing JSON" }, ctx)).toBe(
    "GitHub a répondu 400.",
  );
});

test("a rate limit shows the local resume time when it is known", () => {
  const resumeAt = new Date(2026, 8, 26, 16, 8).getTime();
  const limited = { code: "RATE_LIMITED" as const, message: "github paused until 2026-09-26T14:08:50Z" };
  expect(syncErrorText(limited, { ...ctx, resumeAt })).toBe("Limite GitHub atteinte, reprise à 16:08");
  expect(syncErrorText(limited, ctx)).toBe("Limite GitHub atteinte, reprise automatique.");
});

test("other failures get a French text", () => {
  expect(syncErrorText({ code: "REMOTE_UNAVAILABLE", message: "github 502" }, ctx)).toBe(
    "GitHub est injoignable pour le moment, nouvel essai automatique.",
  );
  expect(syncErrorText({ code: "TIMEOUT", message: "no answer" }, ctx)).toBe(
    "GitHub est injoignable pour le moment, nouvel essai automatique.",
  );
  expect(syncErrorText({ code: "NOT_CONNECTED", message: "connect github first" }, ctx)).toBe(
    "GitHub n'est pas connecté : connecte-le dans Paramètres › Intégrations.",
  );
  expect(syncErrorText({ code: "INTERNAL", message: "boom" }, ctx)).toBe("Une erreur est survenue.");
});

test("a thrown error becomes a failure", () => {
  expect(failureOf(new KiboError("RATE_LIMITED", "github paused"))).toEqual({
    code: "RATE_LIMITED",
    message: "github paused",
  });
  expect(failureOf(new Error("daemon unreachable"))).toEqual({
    code: "INTERNAL",
    message: "daemon unreachable",
  });
});
