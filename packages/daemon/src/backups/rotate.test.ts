import { expect, test } from "bun:test";
import type { BackupInfo } from "@kibo/schema";
import { toRotate } from "./rotate";

const b = (id: string, reason: BackupInfo["reason"], createdAt: number): BackupInfo => ({
  id,
  reason,
  createdAt,
  bytes: 1,
  appVersion: "1.5.0",
});

test("only automatic backups beyond the keep count are rotated, oldest first", () => {
  const list = [
    b("a", "auto", 1),
    b("b", "manual", 2),
    b("c", "auto", 3),
    b("d", "update", 4),
    b("e", "auto", 5),
  ];
  expect(toRotate(list, 2).map((x) => x.id)).toEqual(["a"]);
  expect(toRotate(list, 1).map((x) => x.id)).toEqual(["a", "c"]);
  expect(toRotate(list, 7)).toEqual([]);
});

test("the input order does not matter", () => {
  const list = [b("e", "auto", 5), b("a", "auto", 1), b("c", "auto", 3)];
  expect(toRotate(list, 1).map((x) => x.id)).toEqual(["a", "c"]);
});
