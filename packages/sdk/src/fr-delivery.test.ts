import { expect, test } from "bun:test";
import { deliveryTexts } from "./fr-delivery";

const hold = { key: "SILO-33", reason: "Serveur MinIO de recette indisponible", since: "2026-10-16" };

test("a step on hold says why, its own reason or the step it waits for", () => {
  expect(deliveryTexts.reason({ kind: "onHold", hold: { ...hold, source: "own" } })).toBe(
    "en attente : Serveur MinIO de recette indisponible",
  );
  expect(deliveryTexts.reason({ kind: "onHold", hold: { ...hold, source: "dependency" } })).toBe(
    "en attente de SILO-33",
  );
});
