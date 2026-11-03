import { afterEach, expect, test } from "bun:test";
import { type LaneFrame, type LaneStep, SEGMENT_BG, stepRowBorder } from "@kibo/component-graph/models";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneFeatureFrame } from "./PhoneFeatureFrame";

afterEach(cleanup);

const step = (patch: Partial<LaneStep>): LaneStep => ({
  ticketId: "s",
  key: "SILO-40",
  title: "Étape",
  tone: "todo",
  git: null,
  session: false,
  hold: null,
  startable: false,
  thread: null,
  ...patch,
});

const STARTABLE = step({ ticketId: "s46", key: "SILO-46", title: "Démo client", startable: true });
const WAITING = step({
  ticketId: "s45",
  key: "SILO-45",
  title: "Conflits de saisie",
  tone: "review",
  git: { kind: "pr", tone: "amber" },
  session: true,
  thread: {
    threadId: "thr",
    link: "t3-thread://silo/45",
    title: "SILO-45",
    status: "waiting",
    startedAt: 0,
    checkedAt: 0,
  },
});
const HELD = step({
  ticketId: "s44",
  key: "SILO-44",
  title: "Synchro au retour du réseau",
  tone: "hold",
  hold: { source: "own", reason: "Client", key: "", since: "2026-10-01" },
});
const MERGED = step({
  ticketId: "s42",
  key: "SILO-42",
  title: "Schéma local des constats",
  tone: "done",
  git: { kind: "merged", tone: "green" },
});

const FRAME: LaneFrame = {
  id: "f4",
  shortKey: "F4",
  title: "Saisir un constat hors ligne",
  done: 1,
  total: 4,
  delivered: false,
  held: 1,
  late: true,
  collapsed: false,
  folded: false,
  segments: [MERGED, HELD, WAITING, STARTABLE].map((s) => ({ ticketId: s.ticketId, tone: s.tone })),
  steps: [MERGED, HELD, WAITING, STARTABLE],
  footer: { kind: "late", slipTo: "S43" },
  titleLines: 1,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

const noop = () => undefined;

test("a feature frame shows its segments and steps with the same classes as the desktop rows", () => {
  render(<PhoneFeatureFrame frame={FRAME} folded={false} onOpen={noop} onMenu={noop} />);
  const frame = screen.getByRole("article", { name: "F4 Saisir un constat hors ligne" });
  expect(frame.className).toContain("border-dashed");
  expect(frame.className).toContain("border-(--tracking-red)");
  expect(frame.textContent).toContain("1/4");
  const segments = Array.from(frame.querySelectorAll("[data-slot=frame-segments] > span"));
  expect(segments.map((s) => s.getAttribute("data-tone"))).toEqual(["done", "hold", "review", "todo"]);
  expect(segments[2]?.className).toContain(SEGMENT_BG.review);
  const rows = within(frame).getAllByRole("listitem");
  expect(rows).toHaveLength(4);
  for (const [i, s] of FRAME.steps.entries()) {
    expect(rows[i]?.className).toContain(stepRowBorder(s));
    expect(rows[i]?.className).toContain("min-h-11");
  }
  expect(rows[3]?.className).toContain("border-(--tracking-green)");
  expect(rows[3]?.getAttribute("data-startable")).toBe("true");
  expect(rows[2]?.className).toContain("border-(--tracking-amber)");
  expect(within(rows[2] as HTMLElement).getByRole("img", { name: "T3 · attend ta réponse" })).toBeTruthy();
  expect(rows[1]?.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("hold");
  expect(within(rows[1] as HTMLElement).getByRole("img", { name: "En attente : Client" })).toBeTruthy();
  expect(within(rows[0] as HTMLElement).getByLabelText("PR fusionnée")).toBeTruthy();
  expect(within(frame).getByRole("img", { name: "1 en attente" })).toBeTruthy();
  expect(frame.textContent).toContain("en retard · glisse en S43");
});

test("a blocked feature says which question holds it", () => {
  render(
    <PhoneFeatureFrame
      frame={{ ...FRAME, late: false, footer: { kind: "blocked", question: "Q14" } }}
      folded={false}
      onOpen={noop}
      onMenu={noop}
    />,
  );
  const frame = screen.getByRole("article");
  expect(frame.className).not.toContain("border-(--tracking-red)");
  expect(frame.textContent).toContain("bloquée par Q14");
});

test("tapping the title opens the feature, tapping a step opens its ticket", async () => {
  const opened: string[] = [];
  render(<PhoneFeatureFrame frame={FRAME} folded={false} onOpen={(id) => opened.push(id)} onMenu={noop} />);
  await userEvent.click(screen.getByRole("button", { name: "Saisir un constat hors ligne" }));
  await userEvent.click(screen.getByRole("button", { name: /Démo client/ }));
  expect(opened).toEqual(["f4", "s46"]);
});

test("a folded frame keeps its title and segments and unfolds on tap", async () => {
  const toggled: string[] = [];
  render(
    <PhoneFeatureFrame
      frame={FRAME}
      folded
      onToggle={(id) => toggled.push(id)}
      onOpen={noop}
      onMenu={noop}
    />,
  );
  const frame = screen.getByRole("article");
  expect(within(frame).queryAllByRole("listitem")).toHaveLength(0);
  expect(frame.querySelectorAll("[data-slot=frame-segments] > span")).toHaveLength(4);
  expect(within(frame).getByRole("img", { name: "en retard · glisse en S43" })).toBeTruthy();
  const button = within(frame).getByRole("button");
  expect(button.getAttribute("aria-expanded")).toBe("false");
  await userEvent.click(button);
  expect(toggled).toEqual(["f4"]);
});

test("in « Tout voir », the title of an unfolded frame folds it back", async () => {
  const toggled: string[] = [];
  render(
    <PhoneFeatureFrame
      frame={FRAME}
      folded={false}
      onToggle={(id) => toggled.push(id)}
      onOpen={noop}
      onMenu={noop}
    />,
  );
  const title = screen.getByRole("button", { name: "Saisir un constat hors ligne" });
  expect(title.getAttribute("aria-expanded")).toBe("true");
  await userEvent.click(title);
  expect(toggled).toEqual(["f4"]);
});
