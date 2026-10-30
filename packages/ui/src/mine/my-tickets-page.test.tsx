import { afterEach, expect, mock, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { fac, kib, mineSnapshots, por } from "./fixtures";

mock.module("../api", () =>
  apiMock({ client: { rpc: () => Promise.resolve([]), subscribeIntegrations: () => () => {} } }),
);
const { MyTicketsPage } = await import("./MyTicketsPage");

afterEach(cleanup);

test("Mes tickets renders the work list without agent tabs", async () => {
  render(
    <MyTicketsPage
      viewer="adam"
      projects={[kib, por, fac]}
      snapshots={mineSnapshots}
      onOpenTicket={() => {}}
    />,
  );
  await act(async () => {});
  expect(screen.getByRole("region", { name: "En cours" })).toBeTruthy();
  expect(screen.queryByText("Mes agents")).toBeNull();
  expect(screen.queryByRole("button", { name: "Assigner" })).toBeNull();
});
