import { expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NO_DIALOG } from "./ShellDialogs";

const calls: string[] = [];
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req.method);
      return new Promise(() => {});
    },
    subscribeEvents: () => () => undefined,
  },
}));
const { HelpDialogs } = await import("./HelpDialogs");

test("the shortcuts help opens from its key and closing clears it", async () => {
  const patches: object[] = [];
  render(<HelpDialogs state={{ ...NO_DIALOG, shortcutsHelp: true }} set={(p) => patches.push(p)} />);
  await screen.findByRole("dialog", { name: "Raccourcis" });
  await userEvent.setup().keyboard("{Escape}");
  expect(patches).toEqual([{ shortcutsHelp: false }]);
  expect(calls).not.toContain("getDiagnostics");
});

test("the report dialog opens from its key and asks the daemon for diagnostics", async () => {
  const patches: object[] = [];
  render(<HelpDialogs state={{ ...NO_DIALOG, report: true }} set={(p) => patches.push(p)} />);
  await screen.findByRole("dialog", { name: "Signaler un problème" });
  expect(calls).toContain("getDiagnostics");
  await userEvent.setup().keyboard("{Escape}");
  expect(patches).toEqual([{ report: false }]);
});
