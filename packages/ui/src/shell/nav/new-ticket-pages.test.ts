import { expect, test } from "bun:test";
import type { Instance } from "@kibo/schema";
import { NEW_TICKET_PAGES, newTicketSource } from "./new-ticket-pages";

const at = (component: string, pageId = "pg"): Instance => ({
  id: `i-${component}`,
  pageId,
  component,
  layout: { x: 0, y: 0, w: 12, h: 8 },
  config: {},
  componentHash: null,
});

test("« Nouveau ticket » sits on the Tickets and Vue d'ensemble pages only", () => {
  expect(NEW_TICKET_PAGES).toEqual(["tickets", "overview"]);
  expect(newTicketSource("pg", [at("tickets@1.0.0")])).toBe("component");
  expect(newTicketSource("pg", [at("overview@1.0.0")])).toBe("shell");
  expect(newTicketSource("pg", [at("kanban@1.0.0")])).toBeNull();
  expect(newTicketSource("pg", [at("overview@1.0.0", "other")])).toBeNull();
});
