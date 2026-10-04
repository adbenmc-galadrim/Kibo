import { expect, mock, test } from "bun:test";

const revealItemInDir = mock(async (_path: string) => undefined);
mock.module("@tauri-apps/plugin-opener", () => ({ revealItemInDir }));
const { revealInDir } = await import("./reveal");

test("reveals the folder in the system file manager", async () => {
  await revealInDir("/Users/adam/.kibo/backups");
  expect(revealItemInDir).toHaveBeenLastCalledWith("/Users/adam/.kibo/backups");
});
