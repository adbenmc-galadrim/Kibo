import { expect, test } from "bun:test";
import { emitToast, onToast } from "./toast-bus";

test("an emitted toast reaches its listeners until they leave", () => {
  const heard: string[] = [];
  const off = onToast((message) => heard.push(message));
  emitToast("Copié");
  off();
  emitToast("Ignoré");
  expect(heard).toEqual(["Copié"]);
});
