import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return outcome();
    },
  },
}));
const { RenamePageDialog } = await import("./RenamePageDialog");
const page = { id: "kanban", title: "Kanban", kind: "view" as const, parentId: null };

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

test("renaming sends the trimmed title and closes", async () => {
  const onClose = mock(() => {});
  render(<RenamePageDialog projectId="p1" page={page} onClose={onClose} />);
  const user = userEvent.setup();
  const field = screen.getByLabelText("Nom");
  expect((field as HTMLInputElement).value).toBe("Kanban");
  await user.clear(field);
  await user.type(field, "  Tableau ");
  await user.click(screen.getByRole("button", { name: "Renommer" }));
  expect(calls).toEqual([
    {
      method: "command",
      projectId: "p1",
      command: { method: "renamePage", pageId: "kanban", title: "Tableau" },
    },
  ]);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a blank title cannot be submitted; a refusal keeps the dialog open with the error", async () => {
  outcome = () => Promise.reject(new KiboError("INVALID_INPUT", "empty"));
  const onClose = mock(() => {});
  render(<RenamePageDialog projectId="p1" page={page} onClose={onClose} />);
  const user = userEvent.setup();
  const field = screen.getByLabelText("Nom");
  await user.clear(field);
  await user.type(field, "   ");
  expect((screen.getByRole("button", { name: "Renommer" }) as HTMLButtonElement).disabled).toBe(true);
  await user.type(field, "x");
  await user.click(screen.getByRole("button", { name: "Renommer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de renommer la page.");
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Nom")).toBeTruthy();
});
