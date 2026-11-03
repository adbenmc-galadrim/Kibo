import { expect, test } from "bun:test";
import config from "../vite.config";

test("sonner resolves to the phone toast module, which injects no style", () => {
  const alias = config.resolve?.alias;
  const sonner = alias && !Array.isArray(alias) && "sonner" in alias ? alias.sonner : null;
  expect(String(sonner)).toEndWith("/packages/phone/src/toast.ts");
});
