import { afterEach, expect, jest, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import { Question, type Status } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeldToast } from "./HeldToast";
import { manifest } from "./index";
import { KanbanCardPreview } from "./KanbanCardPreview";
import { KanbanColumn } from "./KanbanColumn";
import { seed } from "./test-seed";
import { useHeldToast } from "./use-held-toast";

afterEach(cleanup);

const question = Question.parse({
  id: "7@1",
  ticketId: "2@1",
  runId: null,
  title: "Quel format pour l'import Excel ?",
  context: "",
  options: [],
  provisional: null,
  blocking: true,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: 0,
  number: 14,
  answer: null,
});

test("a refused drop shows « SILO-51 reste bloqué par Q14 » and « Répondre » opens the question", async () => {
  const m = createMockSdk(manifest, {});
  const views: { id: string; question: string | undefined }[] = [];
  const sdk = {
    ...m.sdk,
    openView: (id: string, opts?: { question?: string }) => views.push({ id, question: opts?.question }),
  };
  let closed = 0;
  render(
    <SdkProvider sdk={sdk}>
      <HeldToast ticketKey="SILO-51" question={question} onClose={() => closed++} />
    </SdkProvider>,
  );
  const toast = screen.getByRole("region", { name: "SILO-51 reste bloqué par Q14" });
  expect(toast.textContent).toContain("SILO-51 reste bloqué par Q14");
  await userEvent.setup().click(screen.getByRole("button", { name: "Répondre" }));
  expect(views).toEqual([{ id: "questions", question: "7@1" }]);
  expect(closed).toBe(1);
});

const status: Status = { id: "in_progress", label: "En cours", order: 2 };

const column = (forbidden: boolean) =>
  render(
    <DndContext>
      <KanbanColumn status={status} ids={[]} targeted={false} forbidden={forbidden}>
        {null}
      </KanbanColumn>
    </DndContext>,
  );

test("a column the held card cannot enter is greyed with a « not allowed » cursor", () => {
  column(true);
  const region = screen.getByRole("region", { name: "En cours" });
  expect(region.dataset.forbidden).toBe("true");
  expect(region.className).toContain("opacity-50");
  expect(region.className).toContain("cursor-not-allowed");
});

test("a column open to the dragged card stays as it is", () => {
  column(false);
  const region = screen.getByRole("region", { name: "En cours" });
  expect(region.dataset.forbidden).toBeUndefined();
  expect(region.className).not.toContain("cursor-not-allowed");
});

const preview = (refused: boolean) => {
  const m = createMockSdk(manifest, { seed });
  const ticket = m.snapshot().tickets.find((t) => t.keyLabel === "KIB-1");
  if (!ticket) throw new Error("no seeded ticket");
  render(
    <SdkProvider sdk={m.sdk}>
      <KanbanCardPreview
        ticket={ticket}
        group={null}
        run={null}
        ciRuns={[]}
        blocked
        blocking={question}
        members={[]}
        remote={[]}
        questions={{ questions: [], recipients: [], runLabel: () => "", onOpen: () => {} }}
        readOnly={false}
        refused={refused}
      />
    </SdkProvider>,
  );
  const found = document.querySelector('[data-slot="kanban-drag-preview"]');
  if (!(found instanceof HTMLElement)) throw new Error("no preview");
  return found;
};

test("over a forbidden column, the dragged card shows the « not allowed » cursor", () => {
  expect(preview(true).className).toContain("cursor-not-allowed");
  cleanup();
  expect(preview(false).className).toContain("cursor-grabbing");
});

const other = Question.parse({ ...question, id: "8@1", number: 15 });

const holder = () => {
  const m = createMockSdk(manifest, { seed });
  const card = m.snapshot().tickets.find((t) => t.keyLabel === "KIB-1");
  if (!card) throw new Error("no seeded ticket");
  let hold: ReturnType<typeof useHeldToast>["hold"] = () => {};
  function Holder() {
    const held = useHeldToast();
    hold = held.hold;
    return held.toast;
  }
  render(
    <SdkProvider sdk={m.sdk}>
      <Holder />
    </SdkProvider>,
  );
  return { card, hold: (q: Question) => act(() => hold(card, q)) };
};

const toastShown = () => screen.queryByRole("region", { name: /reste bloqué par/ }) !== null;
const wait = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

test("the refusal toast closes after 8 s, and each new refusal restarts the delay, on the same card too", () => {
  jest.useFakeTimers();
  try {
    const { hold } = holder();
    hold(question);
    wait(7_999);
    expect(toastShown()).toBe(true);
    wait(1);
    expect(toastShown()).toBe(false);

    hold(question);
    wait(6_000);
    hold(other);
    wait(6_000);
    expect(screen.getByRole("region", { name: "KIB-1 reste bloqué par Q15" })).toBeTruthy();
    wait(2_000);
    expect(toastShown()).toBe(false);

    hold(question);
    wait(6_000);
    hold(question);
    wait(6_000);
    expect(toastShown()).toBe(true);
    wait(2_000);
    expect(toastShown()).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});
