import { expect, test } from "bun:test";
import config from "../vite.config";

test("sonner resolves to the phone toast module, which injects no style", () => {
  const alias = config.resolve?.alias;
  const sonner = alias && !Array.isArray(alias) && "sonner" in alias ? alias.sonner : null;
  expect(String(sonner)).toEndWith("/packages/phone/src/toast.ts");
});

test("the project agent modules of packages/ui are side-effect free, so the lazy agent screen stays out of the entry", () => {
  const treeshake = config.build?.rollupOptions?.treeshake;
  const sideEffects = treeshake && typeof treeshake === "object" ? treeshake.moduleSideEffects : undefined;
  if (typeof sideEffects !== "function") throw new Error("moduleSideEffects is not a function");
  expect(sideEffects("/repo/packages/ui/src/project-agent/QuestionText.tsx", false)).toBe(false);
  expect(sideEffects("/repo/packages/ui/src/index.css", false)).toBe(true);
  expect(sideEffects("/repo/packages/phone/src/main.tsx", false)).toBe(true);
});
