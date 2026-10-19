import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { siloHomeSnapshot, summaryOf } from "./home-fixtures";

const rpcCalls: string[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: { method: string }) => {
        rpcCalls.push(req.method);
        if (req.method === "getAppInfo") return { today: "2026-10-16" };
        throw new Error(`unexpected rpc ${req.method}`);
      },
      subscribe: () => () => {},
    },
  }),
);

const { HomeView } = await import("./HomeView");

beforeEach(() => setSystemTime(new Date(2026, 9, 18, 10)));
afterEach(() => setSystemTime());

test("the home counts on the day of the daemon, not of the browser", async () => {
  const snapshot = siloHomeSnapshot();
  render(
    <HomeView
      viewer="adam"
      projects={[summaryOf(snapshot)]}
      snapshots={new Map([["silo", snapshot]])}
      inboxCount={0}
      onNewProject={() => {}}
      onOpenInbox={() => {}}
    />,
  );
  const card = await screen.findByRole("article", { name: "Silo" });
  const risk = await within(card).findByText("fonctionnalité à risque");
  expect(risk.textContent).toBe("1 fonctionnalité à risque");
  expect(risk.querySelector("[data-tone=amber]")).toBeTruthy();
  expect(within(card).queryByText(/en retard/)).toBeNull();
  expect(rpcCalls).toEqual(["getAppInfo"]);
});
