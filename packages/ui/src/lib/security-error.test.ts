import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { securityErrorText, securityFailure } from "./security-error";

test("known codes are translated, anything else falls back", () => {
  expect(securityErrorText("FORBIDDEN")).toBe("réservé à une session locale (127.0.0.1)");
  expect(securityErrorText("TLS_REQUIRED")).toBe("erreur interne du démon");
  expect(securityErrorText("fallback")).toBe("erreur interne du démon");
  expect(securityFailure(new KiboError("INVALID_INPUT", "raw"))).toBe(
    "vérifie l'interface, le port (déjà pris ?) et les fichiers du certificat",
  );
  expect(securityFailure(new Error("boom"))).toBe("erreur interne du démon");
});
