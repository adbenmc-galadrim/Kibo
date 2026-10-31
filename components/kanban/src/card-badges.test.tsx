import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SignalBadge } from "./CardBadges";

afterEach(cleanup);

test("the blocked badge names the blocking question, or just says blocked", () => {
  const blocked = (question: Parameters<typeof SignalBadge>[0]["signal"] & { kind: "blocked" }) =>
    render(<SignalBadge signal={question} />);
  blocked({
    kind: "blocked",
    question: { number: 3, importRef: { kind: "import_ref", source: "plan", id: "Q14" } },
  });
  expect(screen.getByText("bloqué · Q14")).toBeTruthy();
  cleanup();
  blocked({ kind: "blocked", question: { number: 7, importRef: null } });
  expect(screen.getByText("bloqué · Q7")).toBeTruthy();
  cleanup();
  blocked({ kind: "blocked", question: null });
  expect(screen.getByText("bloqué")).toBeTruthy();
});

test("the hold chip is full cyan like the blocked one, its label and text unchanged", () => {
  render(
    <SignalBadge
      signal={{
        kind: "held",
        hold: {
          source: "own",
          key: "SILO-33",
          reason: "Serveur MinIO de recette indisponible",
          since: "2026-10-16",
        },
      }}
    />,
  );
  const badge = screen.getByRole("note", { name: "En attente : Serveur MinIO de recette indisponible" });
  expect(badge.textContent).toBe("Serveur MinIO de recette…");
  expect(badge.className).toContain("bg-(--tracking-hold-soft) text-(--tracking-hold)");
  expect(badge.className).not.toContain("border-dashed");
});
