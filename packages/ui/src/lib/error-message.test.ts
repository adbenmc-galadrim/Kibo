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
