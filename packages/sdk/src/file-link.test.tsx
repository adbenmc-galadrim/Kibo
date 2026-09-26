import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkifiedText, linkifyPaths, parseFileRef } from "./file-link";

test("paths with or without line and column are recognised", () => {
  expect(parseFileRef("ticket.ts:42")).toEqual({ path: "ticket.ts", line: 42, column: null });
  expect(parseFileRef("packages/core/src/ticket.ts:43:3")).toEqual({
    path: "packages/core/src/ticket.ts",
    line: 43,
    column: 3,
  });
  expect(parseFileRef("src/app/Makefile.d/rules")).toBeNull();
  expect(parseFileRef("kibo.dev")).toBeNull();
});

test("URLs, versions and e-mails are not links", () => {
  for (const text of [
    "https://github.com/kibo/a.ts",
    "version 1.2.3",
    "adam@example.test",
    "claude.com/claude-code",
  ]) {
    expect(linkifyPaths(text).every((s) => s.kind === "text")).toBe(true);
  }
});

test("free text is split around file references", () => {
  expect(
    linkifyPaths("Edit packages/core/ticket.ts:42 puis README.md.").map((s) => [s.kind, s.text]),
  ).toEqual([
    ["text", "Edit "],
    ["file", "packages/core/ticket.ts:42"],
    ["text", " puis "],
    ["file", "README.md"],
    ["text", "."],
  ]);
});

test("LinkifiedText renders clickable references", async () => {
  const opened: unknown[] = [];
  render(<LinkifiedText text="voir ticket.ts:42" onOpen={(r) => opened.push(r)} />);
  await userEvent.click(screen.getByRole("button", { name: "ticket.ts:42" }));
  expect(opened).toEqual([{ path: "ticket.ts", line: 42 }]);
});
