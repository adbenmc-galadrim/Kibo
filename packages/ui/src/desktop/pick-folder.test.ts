import { expect, mock, test } from "bun:test";

const open = mock(async (_opts: unknown): Promise<string | string[] | null> => "/Users/adam/code/kibo");
mock.module("@tauri-apps/plugin-dialog", () => ({ open }));
const { pickFolder } = await import("./pick-folder");

test("asks the native dialog for one directory, starting from the current folder", async () => {
  expect(await pickFolder("/Users/adam")).toBe("/Users/adam/code/kibo");
  expect(open).toHaveBeenLastCalledWith({ directory: true, multiple: false, defaultPath: "/Users/adam" });
});

test("a cancelled dialog gives null, and no default path is sent when none is known", async () => {
  open.mockImplementationOnce(async () => null);
  expect(await pickFolder(null)).toBeNull();
  expect(open).toHaveBeenLastCalledWith({ directory: true, multiple: false });
});
