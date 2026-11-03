import { beforeEach, expect, test } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { phoneFixture } from "./app-test-kit";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/atelier/kanban";
});

test("a removed project leaves the picker and the first enabled project is selected", async () => {
  const { api, runtime } = await phoneFixture();
  render(<App runtime={runtime} />);
  await screen.findByRole("button", { name: /Atelier/ });
  api.blobs.delete("atelier/project");
  await act(() =>
    runtime.client.handleEvent({ type: "snapshot.removed", projectId: "atelier", kind: "project" }),
  );
  await waitFor(() => expect(window.location.hash).toBe("#/p/silo/kanban"));
  await userEvent.click(await screen.findByRole("button", { name: /Silo/ }));
  const picker = await screen.findByRole("dialog", { name: "Projets" });
  expect(
    within(picker)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Silo"]);
});

test("picking a project keeps the current tab", async () => {
  const { runtime } = await phoneFixture();
  render(<App runtime={runtime} />);
  await userEvent.click(await screen.findByRole("button", { name: /Atelier/ }));
  await userEvent.click(
    within(await screen.findByRole("dialog", { name: "Projets" })).getByRole("button", { name: "Silo" }),
  );
  await waitFor(() => expect(window.location.hash).toBe("#/p/silo/kanban"));
  expect(screen.queryByRole("dialog")).toBeNull();
});
