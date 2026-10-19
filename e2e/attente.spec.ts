import { expect, test } from "@playwright/test";
import { attenteCli, onHoldOf, openAttente } from "./attente-kit";
import { SILO_HOLD_SINCE } from "./fixtures/silo-attente";

test.describe.configure({ mode: "serial" });

test("the on-hold scenario is seeded", async ({ page }, info) => {
  const silo = await openAttente(page);
  expect(attenteCli(info, ["tickets", "get", "SILO-45"])).toMatchObject({
    key: "SILO-45",
    onHold: { source: "own", since: SILO_HOLD_SINCE },
  });
  expect(await onHoldOf(page, silo, "SILO-34")).toMatchObject({ source: "dependency", key: "SILO-33" });
});
