import { describe, expect, test } from "bun:test";
import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { DaemonError } from "./daemon-client";
import { explainError } from "./error-text";

const explain = (code: KiboErrorCode, detail: string) => explainError(new KiboError(code, detail));

describe("explainError", () => {
  test("a sprint on a step points to its feature", () => {
    expect(explain("INVALID_INPUT", "a step inherits the sprint of its feature: set it on F5")).toBe(
      "Le sprint d'une étape vient de sa fonctionnalité : posez-le sur F5.",
    );
  });

  test("a feature does not move", () => {
    expect(explain("INVALID_INPUT", "a feature is a root ticket")).toBe(
      "Une fonctionnalité est un ticket racine : elle ne se déplace pas sous un autre ticket.",
    );
  });

  test("links", () => {
    expect(explain("INVALID_INPUT", "link already exists")).toBe("Ce lien existe déjà.");
    expect(explain("LINK_CYCLE", "this dependency would create a cycle")).toBe(
      "Cette dépendance créerait un cycle.",
    );
    expect(explain("INVALID_INPUT", "a ticket cannot link to itself")).toBe(
      "Un ticket ne peut pas dépendre de lui-même.",
    );
  });

  test("status, hold and optional steps", () => {
    expect(explain("BLOCKED_REASON_REQUIRED", "a blocked ticket needs a reason")).toBe(
      "Le statut bloqué demande une raison (reason=…).",
    );
    expect(explain("INVALID_INPUT", "a hold needs a step (a feature cannot be held)")).toBe(
      "Une attente se pose sur une étape, pas sur une fonctionnalité.",
    );
    expect(explain("INVALID_INPUT", "an optional step needs a parent ticket")).toBe(
      "Seule une étape peut être facultative.",
    );
  });

  test("sprints", () => {
    expect(explain("CONFLICT", "sprint code S43 is already taken")).toBe(
      "Le code S43 est déjà pris par un autre sprint.",
    );
    expect(explain("INVALID_INPUT", "invalid sprint: end before start")).toBe(
      "La fin du sprint précède son début.",
    );
  });

  test("a read-only project", () => {
    const text = "Ce projet est en lecture seule sur cette machine.";
    expect(explain("READ_ONLY", "project p-silo is read only")).toBe(text);
    expect(explain("FORBIDDEN", "project p-silo is read-only")).toBe(text);
    expect(explain("READ_ONLY", "skill relire is read only")).toBeNull();
  });

  test("questions", () => {
    expect(explain("INVALID_INPUT", "question q-1 is archived")).toBe(
      "Cette question est archivée : rouvrez-la d'abord.",
    );
    expect(explain("INVALID_TRANSITION", "question q-1 is archived: restore it first")).toBe(
      "Cette question est archivée : rouvrez-la d'abord.",
    );
    expect(explain("INVALID_INPUT", "the provisional choice is not an option")).toBe(
      "Le choix provisoire doit être une des options.",
    );
  });

  test("files and feature targets", () => {
    expect(explain("NOT_FOUND", "file not found: notes/silo.md")).toBe("Fichier introuvable : notes/silo.md");
    expect(explain("INVALID_INPUT", "SILO-33 is a step of F5: give the feature")).toBe(
      "SILO-33 est une étape de F5 : donnez la fonctionnalité.",
    );
  });

  test("a daemon error is translated too", () => {
    const e = new DaemonError("INVALID_INPUT", "link already exists", { home: "/tmp", version: "0.32.0" });
    expect(explainError(e)).toBe("Ce lien existe déjà.");
  });

  test("an unknown detail, or the right detail under another code, is not translated", () => {
    expect(explain("INVALID_INPUT", "ticket t-9 not found")).toBeNull();
    expect(explain("NOT_FOUND", "sprint code S43 is already taken")).toBeNull();
  });
});
