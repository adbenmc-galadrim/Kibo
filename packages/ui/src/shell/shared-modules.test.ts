import { expect, test } from "bun:test";
import { SHARED_SPECIFIERS } from "@kibo/schema";
import { exposeSharedModules, SHARED_MODULES } from "./shared-modules";

test("every shared specifier except lucide-react is exposed to trusted modules", () => {
  expect(Object.keys(SHARED_MODULES).sort()).toEqual(
    SHARED_SPECIFIERS.filter((s) => s !== "lucide-react").sort(),
  );
  exposeSharedModules();
  expect(Reflect.get(globalThis, "__kiboShared")).toBe(SHARED_MODULES);
});
