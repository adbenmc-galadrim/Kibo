import { describe, expect, test } from "bun:test";
import type { IntegrationStatus } from "@kibo/schema";
import { integrationRow } from "./integration-rows";

const s = (
  patch: Partial<IntegrationStatus> & Pick<IntegrationStatus, "id" | "state">,
): IntegrationStatus => ({
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
  ...patch,
});
const opts = { hasDialog: () => true, time: () => "14:32" };

describe("integration rows (screen 16)", () => {
  test("active rows have a badge and no menu", () => {
    const r = integrationRow(s({ id: "git", state: "active" }), opts);
    expect(r).toMatchObject({
      title: "Git local",
      description: "Branches, commits, worktrees, diff",
      badge: { tone: "ok", label: "Actif" },
      action: null,
      menu: [],
    });
  });
  test("connected github shows the account and the full menu", () => {
    const r = integrationRow(s({ id: "github", state: "connected", account: "adam" }), opts);
    expect(r.description).toBe("PR, reviews, statuts CI · compte adam");
    expect(r.badge).toEqual({ tone: "ok", label: "Connecté" });
    expect(r.menu).toEqual(["configure", "test", "disconnect"]);
  });
  test("mcp lists its servers", () => {
    const r = integrationRow(s({ id: "mcp", state: "connected", servers: ["context7", "filesystem"] }), opts);
    expect(r.description).toBe("Connecteur générique · 2 serveurs (context7, filesystem)");
    expect(r.menu).toEqual(["configure", "test", "disconnect"]);
  });
  test("disconnected rows offer Connecter only when a dialog exists", () => {
    expect(integrationRow(s({ id: "figma", state: "disconnected" }), opts)).toMatchObject({
      action: "connect",
      badge: null,
      menu: [],
    });
    expect(
      integrationRow(s({ id: "figma", state: "disconnected" }), { ...opts, hasDialog: () => false }).action,
    ).toBeNull();
  });
  test("figma shows its account or the mcp server", () => {
    expect(integrationRow(s({ id: "figma", state: "connected", account: "adam" }), opts)).toMatchObject({
      title: "Figma",
      description: "Cadres liés aux tickets et widgets Maquette · compte adam",
    });
    expect(integrationRow(s({ id: "figma", state: "connected" }), opts).description).toBe(
      "Cadres liés aux tickets et widgets Maquette · serveur MCP",
    );
  });
  test("penpot shows its account and instance, with the full menu", () => {
    const r = integrationRow(
      s({ id: "penpot", state: "connected", account: "Adam · design.penpot.app" }),
      opts,
    );
    expect(r).toMatchObject({
      title: "Penpot",
      description: "Cadres liés aux tickets et widgets Maquette · Adam · design.penpot.app",
      menu: ["configure", "test", "disconnect"],
    });
  });
  test("disconnected penpot offers Connecter through its dialog", async () => {
    const { dialogOf, INTEGRATION_DIALOGS } = await import("./integration-dialogs");
    const hasDialog = (id: IntegrationStatus["id"]) => {
      const d = dialogOf(id);
      return d !== null && INTEGRATION_DIALOGS[d] !== undefined;
    };
    expect(dialogOf("penpot")).toBe("penpot");
    expect(integrationRow(s({ id: "penpot", state: "disconnected" }), { ...opts, hasDialog })).toMatchObject({
      description: "Cadres liés aux tickets et widgets Maquette",
      action: "connect",
    });
  });
  test("penpot errors are named in French", () => {
    const unreachable = { code: "REMOTE_UNAVAILABLE" as const, message: "penpot 503" };
    expect(integrationRow(s({ id: "penpot", state: "error", error: unreachable }), opts).error).toBe(
      "Instance Penpot injoignable",
    );
    const missing = { code: "NOT_CONNECTED" as const, message: "penpot token missing" };
    expect(integrationRow(s({ id: "penpot", state: "error", error: missing }), opts).error).toBe(
      "Penpot n'est pas connecté",
    );
  });
  test("errors show a French message, Réessayer and the menu", () => {
    const r = integrationRow(
      s({
        id: "github",
        state: "error",
        error: { code: "REMOTE_REJECTED", message: "github 403: Forbidden" },
      }),
      opts,
    );
    expect(r).toMatchObject({
      error: "GitHub a répondu 403 : Forbidden",
      action: "retry",
      badge: { tone: "error", label: "Erreur" },
    });
  });
  test("a github token missing from the keychain asks to reconnect", () => {
    const error = { code: "NOT_CONNECTED" as const, message: "github token missing from the keychain" };
    const r = integrationRow(s({ id: "github", state: "error", account: "adam", error }), opts);
    expect(r).toMatchObject({
      error: "Compte GitHub non connecté : reconnecte ton compte",
      action: "reconnect",
      badge: { tone: "error", label: "Erreur" },
    });
    expect(integrationRow(s({ id: "github-issues", state: "error", error }), opts).action).toBe("reconnect");
  });
  test("a dead mcp server is named in French", () => {
    const r = integrationRow(
      s({
        id: "mcp",
        state: "error",
        servers: ["sentry-staging"],
        error: { code: "MCP_UNAVAILABLE", message: "sentry-staging" },
      }),
      opts,
    );
    expect(r.error).toBe("Serveur sentry-staging injoignable");
  });
  test("a rate limit pauses with its resume time", () => {
    const r = integrationRow(s({ id: "github-issues", state: "connected", resumeAt: 1 }), opts);
    expect(r.badge).toEqual({ tone: "warn", label: "Limite GitHub atteinte, reprise à 14:32" });
  });
  test("penpot with an ignored token asks to reconnect", () => {
    const r = integrationRow(
      s({
        id: "penpot",
        state: "error",
        account: "Anonymous User · localhost:9010",
        error: { code: "TOKEN_IGNORED", message: "penpot ignored the stored access token" },
      }),
      opts,
    );
    expect(r.action).toBe("reconnect");
    expect(r.error).toBe(
      "Penpot ignore le jeton (jetons d'accès désactivés sur l'instance) : reconnecte Penpot",
    );
  });
});
