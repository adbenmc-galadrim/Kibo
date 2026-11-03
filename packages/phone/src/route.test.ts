import { expect, test } from "bun:test";
import { formatRoute, parseRoute } from "./route";

test("project tabs, ticket, agent, pair and login round-trip through the hash", () => {
  const routes = [
    { name: "tab", projectId: "silo", tab: "graph" },
    { name: "tab", projectId: "silo", tab: "dashboard" },
    { name: "ticket", projectId: "silo", ticketId: "t-45" },
    { name: "agent", projectId: "silo" },
    { name: "pair" },
    { name: "login" },
  ] as const;
  for (const route of routes) expect(parseRoute(formatRoute(route))).toEqual(route);
  expect(formatRoute({ name: "tab", projectId: "silo", tab: "kanban" })).toBe("#/p/silo/kanban");
  expect(formatRoute({ name: "ticket", projectId: "silo", ticketId: "t-45" })).toBe("#/p/silo/t/t-45");
});

test("ids are encoded and unknown hashes fall back to home", () => {
  const route = { name: "ticket", projectId: "a/b", ticketId: "x y" } as const;
  expect(parseRoute(formatRoute(route))).toEqual(route);
  expect(parseRoute("")).toEqual({ name: "home" });
  expect(parseRoute("#/p/silo/unknown")).toEqual({ name: "home" });
  expect(parseRoute("#/p/silo")).toEqual({ name: "tab", projectId: "silo", tab: "graph" });
});
