import { describe, expect, test } from "bun:test";
import { type Overlap, type OverlapRole, overlapAlert } from "@kibo/schema";
import { type PendingAlert, pickAlerts } from "./alerts";

const overlap = (id: string, firstSeenAt: number, path = `src/${id}.ts`): Overlap => ({
  id,
  projectId: "p",
  kind: "export",
  key: `export:${id}`,
  ownerRunId: "r12",
  otherRunId: "r15",
  ownerWorkspace: "/w/a",
  otherWorkspace: "/w/b",
  detail: { kind: "export", name: `format${id}`, ownerPath: path, otherPath: "src/utils/date.ts" },
  firstSeenAt,
  lastSeenAt: firstSeenAt,
  status: "open",
  deliveredAt: null,
  ownerDeliveredAt: null,
  resolvedAt: null,
  ignoredBy: null,
  ignoredAt: null,
});

const alert = (
  id: string,
  firstSeenAt: number,
  role: OverlapRole = "other",
  path?: string,
): PendingAlert => ({
  overlap: overlap(id, firstSeenAt, path),
  role,
  withRunName: "bou · livraison · BOU-12",
  withTicketKey: "BOU-12",
});

const textOf = (a: PendingAlert) => overlapAlert(a.role, a.overlap.detail, a.withRunName, a.withTicketKey);

describe("pickAlerts", () => {
  test("nothing pending gives nothing", () => {
    expect(pickAlerts([])).toEqual({ text: null, delivered: [] });
  });

  test("one alert is the alert text", () => {
    const a = alert("o1", 1);
    expect(pickAlerts([a])).toEqual({ text: textOf(a), delivered: [{ overlapId: "o1", role: "other" }] });
  });

  test("an alert is an information, never a request", () => {
    const text = pickAlerts([alert("o1", 1), alert("o2", 2, "owner")]).text ?? "";
    expect(text).toContain("Kibo — information :");
    expect(text).toContain("Rien à justifier.");
    expect(text).toContain("Rien à faire.");
    expect(text).not.toContain("sans demander");
  });

  test("five alerts at most, the rest points to peek_work", () => {
    const pending = Array.from({ length: 7 }, (_, i) => alert(`o${i}`, i));
    const picked = pickAlerts(pending);
    expect(picked.delivered.map((d) => d.overlapId)).toEqual(["o0", "o1", "o2", "o3", "o4"]);
    expect(picked.text).toBe(
      [...pending.slice(0, 5).map(textOf), "… 2 autres : `mcp__kibo__peek_work`"].join("\n\n"),
    );
  });

  test("the alerts stop before the first one that would pass 2 000 characters", () => {
    const long = (id: string, at: number) => alert(id, at, "other", `src/${"x".repeat(800)}/${id}.ts`);
    const pending = [long("o1", 1), long("o2", 2), long("o3", 3)];
    const picked = pickAlerts(pending);
    expect(picked.delivered.map((d) => d.overlapId)).toEqual(["o1"]);
    expect(picked.text?.endsWith("… 2 autres : `mcp__kibo__peek_work`")).toBe(true);
    expect(picked.text?.length).toBeLessThanOrEqual(2_000 + 40);
  });

  test("alerts to the other side come before the owner's, then the oldest first", () => {
    const picked = pickAlerts([alert("a", 1, "owner"), alert("b", 5), alert("c", 2)]);
    expect(picked.delivered).toEqual([
      { overlapId: "c", role: "other" },
      { overlapId: "b", role: "other" },
      { overlapId: "a", role: "owner" },
    ]);
  });
});
