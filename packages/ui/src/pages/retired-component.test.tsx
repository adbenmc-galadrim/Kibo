import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(null);
      },
      subscribe: () => () => undefined,
    },
  }),
);

const { RetiredComponent } = await import("./RetiredComponent");
const fetchSpy = spyOn(globalThis, "fetch");

beforeEach(() => {
  calls.length = 0;
  fetchSpy.mockClear();
});
afterEach(() => fetchSpy.mockClear());

test("an instance of notes renders the retired notice with its ref and the notes sentence, no network call", async () => {
  render(
    <RetiredComponent projectId="p1" instanceId="i1" componentRef="notes@1.0.0" editable compact={false} />,
  );
  expect(screen.getByText("Ce composant n'existe plus dans Kibo.")).toBeTruthy();
  expect(screen.getByText("notes@1.0.0")).toBeTruthy();
  expect(screen.getByText("Tes notes restent dans le dossier du projet.")).toBeTruthy();
  await new Promise((r) => setTimeout(r, 20));
  expect(calls).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("the remove button calls removeInstance only when editable", async () => {
  const { unmount } = render(
    <RetiredComponent projectId="p1" instanceId="i1" componentRef="tickets@1.0.0" editable={false} compact />,
  );
  expect(screen.queryByRole("button", { name: "Retirer de la page" })).toBeNull();
  unmount();
  render(<RetiredComponent projectId="p1" instanceId="i1" componentRef="tickets@1.0.0" editable compact />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Retirer de la page" }));
  await waitFor(() =>
    expect(calls).toEqual([
      { method: "command", projectId: "p1", command: { method: "removeInstance", instanceId: "i1" } },
    ]),
  );
});

test("an unknown ref such as snake renders the same notice without the notes sentence", () => {
  render(
    <RetiredComponent projectId="p1" instanceId="i1" componentRef="snake@1.0.0" editable compact={false} />,
  );
  expect(screen.getByText("Ce composant n'existe plus dans Kibo.")).toBeTruthy();
  expect(screen.getByText("snake@1.0.0")).toBeTruthy();
  expect(screen.queryByText("Tes notes restent dans le dossier du projet.")).toBeNull();
});
