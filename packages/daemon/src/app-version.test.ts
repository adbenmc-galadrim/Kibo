import { expect, test } from "bun:test";
import { appVersion } from "./app-version";

test("the compiled binary reads the version injected at build time", () => {
  expect(appVersion({ KIBO_VERSION: "1.5.0" }, () => '{"version": "9.9.9"}')).toBe("1.5.0");
});

test("in development the version comes from tauri.conf.json", () => {
  expect(appVersion({}, () => '{\n  "productName": "Kibo",\n  "version": "1.4.0"\n}')).toBe("1.4.0");
});

test("without arguments the version is the one of the repository tauri.conf.json", () => {
  expect(appVersion()).toMatch(/^\d+\.\d+\.\d+$/);
});

test("a malformed injected version is refused", () => {
  expect(() => appVersion({ KIBO_VERSION: "dev" }, () => "{}")).toThrow(/not a X\.Y\.Z version/);
});
