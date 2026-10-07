import { expect, test } from "bun:test";
import { ComponentCall } from "./call";
import { permissionOfCall } from "./permissions";

test("config.set carries a record patch and needs no permission", () => {
  const call = ComponentCall.parse({ kind: "config.set", patch: { lighting: "studio", shadows: true } });
  expect(call.kind).toBe("config.set");
  expect(permissionOfCall(call)).toBeNull();
  expect(ComponentCall.safeParse({ kind: "config.set", patch: "x" }).success).toBe(false);
  expect(ComponentCall.safeParse({ kind: "config.set" }).success).toBe(false);
});
