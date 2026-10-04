import { beforeEach, expect, mock, spyOn, test } from "bun:test";
import { type RpcRequest, TUTORIAL_NEVER, type TutorialState } from "@kibo/schema";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest["method"][] = [];
let current: TutorialState = TUTORIAL_NEVER;
let failStart = false;
const started: TutorialState = { ...TUTORIAL_NEVER, status: "active", projectId: "demo", startedAt: 1 };

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req.method);
      if (req.method === "startTutorial")
        return failStart ? Promise.reject(new Error("boom")) : Promise.resolve(started);
      if (req.method === "resetTutorial") return Promise.resolve(TUTORIAL_NEVER);
      return Promise.resolve(current);
    },
    subscribeEvents: () => () => {},
  },
}));

const { TutorialOffer } = await import("./TutorialOffer");

beforeEach(() => {
  calls.length = 0;
  current = TUTORIAL_NEVER;
  failStart = false;
});

const show = () => {
  const onClose = mock(() => {});
  const onOpen = mock((_target: unknown) => {});
  render(<TutorialOffer open onClose={onClose} onOpen={onOpen} />);
  return { onClose, onOpen, dialog: () => within(screen.getByRole("dialog")) };
};

test("the offer lists the six steps and Commencer starts the tour then opens the demo project", async () => {
  const { onClose, onOpen, dialog } = show();
  expect(dialog().getByText("Faire le tour de Kibo ?")).toBeTruthy();
  expect(dialog().getAllByRole("listitem")).toHaveLength(6);
  await userEvent.setup().click(await dialog().findByRole("button", { name: "Commencer" }));
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ kind: "project", projectId: "demo" }));
  expect(onClose).toHaveBeenCalled();
  expect(calls).toEqual(["getTutorial", "startTutorial"]);
});

test("Plus tard closes without any tutorial call", async () => {
  const { onClose, dialog } = show();
  await userEvent.setup().click(dialog().getByRole("button", { name: "Plus tard" }));
  expect(onClose).toHaveBeenCalled();
  expect(calls).toEqual(["getTutorial"]);
});

test("a paused tour offers Reprendre", async () => {
  current = { ...started, status: "paused", completed: ["kanban"] };
  const { onOpen, dialog } = show();
  await userEvent.setup().click(await dialog().findByRole("button", { name: "Reprendre" }));
  await waitFor(() => expect(onOpen).toHaveBeenCalled());
  expect(dialog().queryByRole("button", { name: "Commencer" })).toBeNull();
  expect(calls).toEqual(["getTutorial", "startTutorial"]);
});

test("a finished or skipped tour offers Recommencer, which resets then starts", async () => {
  for (const status of ["done", "skipped"] as const) {
    calls.length = 0;
    current = { ...started, status };
    const { onOpen, dialog } = show();
    await userEvent.setup().click(await dialog().findByRole("button", { name: "Recommencer" }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ kind: "project", projectId: "demo" }));
    expect(calls).toEqual(["getTutorial", "resetTutorial", "startTutorial"]);
    cleanup();
  }
});

test("a failed start keeps the dialog open with an error", async () => {
  failStart = true;
  const logged = spyOn(console, "error").mockImplementation(() => {});
  const { onClose, dialog } = show();
  await userEvent.setup().click(await dialog().findByRole("button", { name: "Commencer" }));
  expect(await dialog().findByRole("alert")).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
  expect(logged).toHaveBeenCalled();
  logged.mockRestore();
});
