import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { errorMessage } from "./error-message";

test("known codes map to French text, git failures keep the first line of stderr", () => {
  expect(errorMessage(new KiboError("GIT_PUSHED", "abc"))).toBe(
    "Ce commit est déjà poussé : il ne peut plus être modifié.",
  );
  expect(errorMessage(new KiboError("GIT_FAILED", "fatal: bad revision\nmore"))).toBe(
    "La commande git a échoué. (fatal: bad revision)",
  );
  expect(errorMessage(new KiboError("INTERNAL", "x"))).toBe("Une erreur est survenue.");
  expect(errorMessage(new Error("boom"))).toBe("Une erreur est survenue.");
});

test("every component error code has its own French text", () => {
  const codes = [
    "HASH_MISMATCH",
    "TRUST_REQUIRED",
    "VERSION_EXISTS",
    "VALIDATION_FAILED",
    "MIGRATION_FAILED",
    "COMPONENT_CRASHED",
    "TIMEOUT",
    "CONFLICT",
    "RATE_LIMITED",
    "QUOTA_EXCEEDED",
    "SANDBOX_UNAVAILABLE",
    "PERMISSION_DENIED",
    "FORBIDDEN",
  ] as const;
  const texts = codes.map((code) => errorMessage(new KiboError(code, "x")));
  for (const text of texts) expect(text).not.toBe("Une erreur est survenue.");
  expect(new Set(texts).size).toBe(codes.length);
  expect(errorMessage(new KiboError("MIGRATION_FAILED", "hello@0.2.0: step 1 failed\nstack"))).toBe(
    "La migration de la configuration a échoué. (hello@0.2.0: step 1 failed)",
  );
});
