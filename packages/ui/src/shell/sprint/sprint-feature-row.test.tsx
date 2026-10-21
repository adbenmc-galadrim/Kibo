import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SprintFeatureRow } from "./SprintFeatureRow";

afterEach(cleanup);

const hold = { source: "own", key: "SILO-33", reason: "Serveur MinIO", since: "2026-10-16" } as const;

test("the steps of a sprint feature keep their order, held ones in cyan", () => {
  render(
    <SprintFeatureRow
      feature={{
        id: "f5",
        shortKey: "F5",
        title: "Envoyer les photos d'un constat",
        status: "open",
        steps: [
          { ticketId: "e31", statusId: "done", onHold: null },
          { ticketId: "e32", statusId: "in_review", onHold: null },
          { ticketId: "e33", statusId: "in_progress", onHold: hold },
          { ticketId: "e34", statusId: "todo", onHold: { ...hold, source: "dependency" } },
        ],
      }}
      onOpen={() => undefined}
    />,
  );
  const bar = screen.getByRole("img", { name: "Étapes de F5" });
  const segments = Array.from(bar.children);
  expect(segments.map((s) => s.getAttribute("data-tone"))).toEqual(["done", "review", "hold", "hold"]);
  expect(segments[3]?.className).toContain("bg-(--tracking-hold)");
});
