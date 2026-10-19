import { expect, test } from "bun:test";
import type { MemberInfo } from "@kibo/schema";
import { memberName } from "./members";

const ADAM = "1789b628-9778-4031-95aa-0dbd53d0ebf5";
const MEMBERS: MemberInfo[] = [{ userId: ADAM, name: "Adam", role: "owner" }];

test("a member is named by the project, an unknown account never shows its id", () => {
  expect(memberName(ADAM, MEMBERS, "un membre")).toBe("Adam");
  expect(memberName("2a4e8c1d-0b3f-4e5a-9c7d-6f8e9a0b1c2d", MEMBERS, "un membre")).toBe("un membre");
  expect(memberName(ADAM.toUpperCase(), [], "un membre")).toBe("un membre");
});

test("a local user name is already readable and stays as written", () => {
  expect(memberName("adam", MEMBERS, "un membre")).toBe("adam");
  expect(memberName("e2e", [], "un membre")).toBe("e2e");
});
