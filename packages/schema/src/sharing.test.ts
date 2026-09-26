import { expect, test } from "bun:test";
import { KeyAllocator, MemberInfo, MemberRole } from "./sharing";

test("roles and allocators are closed sets", () => {
  expect(MemberRole.options).toEqual(["owner", "editor", "viewer"]);
  expect(KeyAllocator.options).toEqual(["local", "server"]);
  expect(MemberRole.safeParse("admin").success).toBe(false);
});

test("a member needs an id, a name and a role", () => {
  expect(MemberInfo.safeParse({ userId: "u1", name: "Léa", role: "editor" }).success).toBe(true);
  expect(MemberInfo.safeParse({ userId: "", name: "Léa", role: "editor" }).success).toBe(false);
});
