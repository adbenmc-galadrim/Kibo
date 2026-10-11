import { describe, expect, test } from "bun:test";
import { isWakeupMessage, type SignalKind, type SignalLine, WAKEUP_PREFIX, wakeupCount } from "@kibo/schema";
import { renderSignalsSection, SIGNAL_KIND_FR, signalReply, wakeupMessage } from "./messages";

const fmt = (at: number): string =>
  `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`;
const kinds = (...list: SignalKind[]) => list.map((kind) => ({ kind }));
const line = (over: Partial<SignalLine> = {}): SignalLine => ({
  ref: "sig:3",
  kind: "blocker",
  runLabel: "opus-dev-3",
  ticketKey: "KIB-16",
  createdAt: 14 * 60 + 28,
  status: "new",
  title: "Attend le schéma Loro de KIB-12",
  body: "",
  ...over,
});

describe("signalReply", () => {
  test("tells the run when the project agent will wake up", () => {
    expect(signalReply({ ref: "sig:3", kind: "ticket" }, { kind: "now" }, fmt)).toBe(
      "Signal sig:3 enregistré. Réveil de l'agent de projet demandé (immédiat).",
    );
    const at = 14 * 60 + 41;
    expect(signalReply({ ref: "sig:3", kind: "blocker" }, { kind: "scheduled", at }, fmt)).toBe(
      "Signal sig:3 enregistré. Réveil de l'agent de projet demandé (prochain réveil possible à 14:41).",
    );
    expect(signalReply({ ref: "sig:5", kind: "ticket" }, { kind: "already", at }, fmt)).toBe(
      "Signal sig:5 enregistré. Réveil de l'agent de projet demandé (prochain réveil possible à 14:41).",
    );
  });

  test("a signal that does not wake is read at the next turn", () => {
    expect(signalReply({ ref: "sig:4", kind: "context" }, { kind: "none" }, fmt)).toBe(
      "Signal sig:4 enregistré. L'agent de projet le lira à son prochain tour.",
    );
  });
});

describe("wakeupMessage", () => {
  test("counts the signals by kind", () => {
    const text = wakeupMessage(kinds("ticket", "ticket", "blocker"));
    expect(text.startsWith(WAKEUP_PREFIX)).toBe(true);
    expect(text).toContain("3 signaux à traiter (2 tickets à créer, 1 blocage)");
    expect(text).toContain("`dismissSignal`");
    expect(wakeupMessage(kinds("ticket"))).toContain("1 signal à traiter (1 ticket à créer)");
    expect(wakeupMessage(kinds("question", "blocker", "context"))).toContain(
      "3 signaux à traiter (1 blocage, 1 contexte, 1 question)",
    );
  });

  test("the count is read back from the message", () => {
    for (const list of [kinds("ticket"), kinds("ticket", "blocker", "context")]) {
      expect(wakeupCount(wakeupMessage(list))).toBe(list.length);
      expect(isWakeupMessage(wakeupMessage(list))).toBe(true);
    }
    expect(wakeupCount("Bonjour")).toBeNull();
    expect(isWakeupMessage("Bonjour")).toBe(false);
  });

  test("kinds have French names", () => {
    expect(SIGNAL_KIND_FR).toEqual({
      ticket: "ticket à créer",
      context: "contexte",
      blocker: "blocage",
      question: "question",
    });
  });
});

describe("renderSignalsSection", () => {
  test("is empty without signals", () => {
    expect(renderSignalsSection([], fmt)).toBe("");
  });

  test("lists each signal with its body indented", () => {
    expect(renderSignalsSection([line({ body: "Ligne 1\nLigne 2" })], fmt)).toBe(
      [
        "## Signaux à traiter",
        "",
        "- sig:3 · blocage · opus-dev-3 · KIB-16 · 14:28 · nouveau — « Attend le schéma Loro de KIB-12 »",
        "  Ligne 1",
        "  Ligne 2",
      ].join("\n"),
    );
    expect(renderSignalsSection([line({ status: "read" })], fmt)).toContain("· déjà lu — ");
  });

  test("bounds the body", () => {
    const section = renderSignalsSection([line({ body: "x".repeat(600) })], fmt);
    const body = section.split("\n").at(-1) ?? "";
    expect(body.startsWith("  x")).toBe(true);
    expect(body.length).toBe(2 + 500);
  });

  test("shows the fifty oldest and points to list_signals", () => {
    const lines = Array.from({ length: 60 }, (_, i) => line({ ref: `sig:${60 - i}`, createdAt: 60 - i }));
    const section = renderSignalsSection(lines, fmt).split("\n");
    const items = section.filter((l) => l.startsWith("- sig:"));
    expect(items).toHaveLength(50);
    expect(items[0]).toStartWith("- sig:1 ");
    expect(items.at(-1)).toStartWith("- sig:50 ");
    expect(section.at(-1)).toBe("- … 10 autres : `list_signals`");
  });
});
