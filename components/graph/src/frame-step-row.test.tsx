import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FrameStepRow } from "./FrameStepRow";
import { fr } from "./fr";
import { manifest } from "./index";
import type { LaneStep } from "./sprint-lanes";

afterEach(cleanup);

const step: LaneStep = {
  ticketId: "t",
  key: "SILO-1",
  title: "Conflits de saisie",
  tone: "review",
  git: { kind: "pr", tone: "purple" },
  session: false,
  hold: { source: "own", reason: "Client", key: "", since: "2026-10-01" },
  startable: false,
  thread: null,
};

const renderRow = (onOpen: (id: string) => void = () => undefined) => {
  render(
    <ul>
      <FrameStepRow step={step} onOpen={onOpen} />
    </ul>,
  );
  return screen.getByRole("listitem");
};

test("dots are 10 px, icons 15 px", () => {
  const row = renderRow();
  expect(row.querySelector("[data-tone]")?.className).toContain("size-2.5");
  const icons = Array.from(row.querySelectorAll("svg"));
  expect(icons).toHaveLength(2);
  for (const icon of icons) expect(icon.getAttribute("width")).toBe("15");
});

test("the row height is 28 and the whole row is a hit area of at least 24 × 24", () => {
  const row = renderRow();
  expect(row.className).toContain("h-7");
  const button = screen.getByRole("button");
  expect(button.className).toContain("size-full");
  expect(button.contains(row.querySelector("[data-tone]"))).toBe(true);
  for (const icon of Array.from(row.querySelectorAll("svg"))) expect(button.contains(icon)).toBe(true);
});

test("clicking a mark opens the step", async () => {
  const opened: string[] = [];
  const row = renderRow((id) => opened.push(id));
  const icon = row.querySelector("svg");
  if (icon === null) throw new Error("missing icon");
  await userEvent.click(icon);
  expect(opened).toEqual(["t"]);
});

const THREAD = {
  threadId: "thr_1",
  link: "t3-thread://v2/env/thr_1",
  title: "SILO-1 · Conflits de saisie",
  status: "running",
  startedAt: 1_000,
  checkedAt: 1_000,
} as const;
const AVAILABLE = { status: { available: true, bin: "t3" } };
const PROJECT = { id: "p1", hasFolder: true };

const renderLaunchRow = (patch: Partial<LaneStep>, launches: string[] = []) => {
  const m = createMockSdk(manifest, { t3: { ...AVAILABLE, launches } });
  render(
    <SdkProvider sdk={m.sdk}>
      <ul>
        <FrameStepRow
          step={{ ...step, git: null, hold: null, ...patch }}
          onOpen={() => {}}
          project={PROJECT}
        />
      </ul>
    </SdkProvider>,
  );
  return screen.getByRole("listitem");
};

test("a startable step reveals Lancer dans T3 on hover and on focus, at the right of the row", async () => {
  const row = renderLaunchRow({ startable: true });
  const launch = await screen.findByRole("button", { name: "Lancer dans T3" });
  const reveal = launch.parentElement;
  expect(reveal?.className).toContain("right-");
  expect(reveal?.className).toContain("opacity-0");
  expect(reveal?.className).toContain("group-hover/step:opacity-100");
  expect(reveal?.className).toContain("group-focus-within/step:opacity-100");
  expect(row.className).toContain("group/step");
});

test("the launch button is reachable by the keyboard right after the row", async () => {
  renderLaunchRow({ startable: true });
  await screen.findByRole("button", { name: "Lancer dans T3" });
  await userEvent.tab();
  expect(document.activeElement?.getAttribute("title")).toBe("SILO-1");
  await userEvent.tab();
  expect(document.activeElement?.textContent).toBe("Lancer dans T3");
});

test("the launch button opens the shared dialog, without opening the ticket", async () => {
  const opened: string[] = [];
  const m = createMockSdk(manifest, { t3: AVAILABLE });
  render(
    <SdkProvider sdk={m.sdk}>
      <ul>
        <FrameStepRow
          step={{ ...step, git: null, hold: null, startable: true }}
          onOpen={(id) => opened.push(id)}
          project={PROJECT}
        />
      </ul>
    </SdkProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Lancer dans T3" }));
  expect(await screen.findByRole("dialog", { name: "Lancer SILO-1 dans T3" })).toBeTruthy();
  expect(opened).toEqual([]);
});

test("a step that is not startable offers no launch", () => {
  renderLaunchRow({ startable: false });
  expect(screen.queryByRole("button", { name: "Lancer dans T3" })).toBeNull();
});

test("a step with a running thread shows the orange ● T3 badge instead of the right icon", () => {
  const row = renderLaunchRow({
    startable: true,
    session: true,
    git: { kind: "branch", tone: "blue" },
    thread: THREAD,
  });
  const pill = within(row).getByRole("img", { name: /^T3 · en cours depuis/ });
  expect(pill.className).toContain("--tracking-brand-soft");
  expect(row.className).toContain("border-(--tracking-brand-line)");
  expect(row.querySelector("svg")).toBeNull();
  expect(within(row).queryByRole("img", { name: fr.sprints.session })).toBeNull();
  expect(screen.queryByRole("button", { name: "Lancer dans T3" })).toBeNull();
});

test("a held step with a thread carries one mark on its right: the pill", () => {
  const row = renderLaunchRow({
    hold: { source: "own", reason: "Client", key: "", since: "2026-10-01" },
    thread: THREAD,
  });
  expect(row.querySelector("svg")).toBeNull();
});

test("the title makes room for the revealed button", async () => {
  renderLaunchRow({ startable: true });
  await screen.findByRole("button", { name: "Lancer dans T3" });
  expect(screen.getByTitle("SILO-1").className).toContain("group-hover/step:pr-");
  expect(screen.getByTitle("SILO-1").className).toContain("group-focus-within/step:pr-");
});

test("a waiting thread shows the amber badge at the same place", () => {
  const row = renderLaunchRow({ thread: { ...THREAD, status: "waiting" } });
  const pill = within(row).getByRole("img", { name: "T3 · attend ta réponse" });
  expect(pill.className).toContain("--tracking-amber-soft");
  expect(row.className).toContain("border-(--tracking-amber)");
});

test("a finished thread leaves the row as it was", () => {
  const row = renderLaunchRow({
    git: { kind: "merged", tone: "green" },
    thread: { ...THREAD, status: "done" },
  });
  expect(within(row).queryByRole("img", { name: /^T3/ })).toBeNull();
  expect(row.querySelector("svg")).not.toBeNull();
});
