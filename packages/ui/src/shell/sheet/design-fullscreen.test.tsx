import { beforeEach, expect, mock, test } from "bun:test";
import { type DesignFrame, EMPTY_PROGRESS, KiboError, type RpcRequest, type TicketView } from "@kibo/schema";
import { Sheet, SheetContent, SheetTitle } from "@kibo/sdk/ui/sheet";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";

const FIGMA_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const FILE = "11111111-1111-4111-8111-111111111111";
const PAGE = "22222222-2222-4222-8222-222222222222";
const BOARD = "33333333-3333-4333-8333-333333333333";
const PENPOT_URL = `https://design.penpot.app/#/workspace/team/proj/${FILE}?page-id=${PAGE}&board-id=${BOARD}`;
const frameOf = (url: string, over: Partial<DesignFrame> = {}): DesignFrame => ({
  id: url,
  provider: url === FIGMA_URL ? "figma" : "penpot",
  name: url === FIGMA_URL ? "Tickets" : "Accueil",
  width: 1440,
  height: 900,
  url: `data:image/png;base64,iVBORw0KGgo=${url === FIGMA_URL ? "F" : "P"}`,
  mime: "image/png",
  fetchedAt: 0,
  stale: false,
  reachable: true,
  source: url,
  ...over,
});

type Reply = () => Promise<DesignFrame>;
let replies: Record<string, Reply> = {};
const calls: RpcRequest[] = [];
mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method !== "getDesignFrame") return null;
        const reply = replies[req.url];
        if (!reply) throw new KiboError("REMOTE_NOT_FOUND", "unknown frame");
        return reply();
      },
    },
  }),
);
const { DesignSection } = await import("./DesignSection");

const ticket: TicketView = {
  id: "t45",
  key: "SILO-45",
  hold: null,
  keyLabel: "SILO-45",
  title: "Conflits de saisie",
  description: "",
  statusId: "in_progress",
  parentId: null,
  assignee: null,
  domainId: null,
  blockedReason: null,
  labels: [],
  externalRefs: [
    { kind: "figma_node", fileKey: "AbC123xyz", nodeId: "12:34", url: FIGMA_URL, name: "Tickets" },
    {
      kind: "penpot_board",
      instance: "https://design.penpot.app",
      fileId: FILE,
      pageId: PAGE,
      boardId: BOARD,
      url: PENPOT_URL,
      name: "Accueil",
    },
  ],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  onHold: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  thread: null,
  updatedAt: null,
  feature: null,
};

const ready =
  (url: string, over: Partial<DesignFrame> = {}): Reply =>
  async () =>
    frameOf(url, over);

const show = () =>
  render(
    <Sheet open>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>SILO-45 · Conflits de saisie</SheetTitle>
        <DesignSection projectId="p1" ticket={ticket} />
      </SheetContent>
    </Sheet>,
  );

const section = () => within(screen.getByRole("region", { name: "Maquettes", hidden: true }));
const frameCalls = () => calls.filter((c) => c.method === "getDesignFrame");

beforeEach(() => {
  calls.length = 0;
  replies = { [FIGMA_URL]: ready(FIGMA_URL), [PENPOT_URL]: ready(PENPOT_URL) };
});

test("each loaded thumbnail gets a fullscreen button, disabled while loading or failed", async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  replies = {
    [FIGMA_URL]: async () => {
      await gate;
      return frameOf(FIGMA_URL);
    },
    [PENPOT_URL]: async () => {
      throw new KiboError("REMOTE_UNAVAILABLE", "down");
    },
  };
  show();
  const [figma, penpot] = await section().findAllByRole("button", { name: "Plein écran" });
  if (!figma || !penpot) throw new Error("a fullscreen button per frame");
  expect(figma.hasAttribute("disabled")).toBe(true);
  expect(section().getByRole("button", { name: "Plein écran · Tickets" }).hasAttribute("disabled")).toBe(
    true,
  );
  release();
  await waitFor(() => expect(figma.hasAttribute("disabled")).toBe(false));
  expect(section().getByRole("button", { name: "Plein écran · Tickets" }).hasAttribute("disabled")).toBe(
    false,
  );
  await section().findByRole("alert");
  expect(penpot.hasAttribute("disabled")).toBe(true);
  expect(section().getByRole("button", { name: "Plein écran · Accueil" }).hasAttribute("disabled")).toBe(
    true,
  );
});

test("fullscreen opens the view on that frame with the ticket key, arrows move to the next frame, Escape returns focus", async () => {
  show();
  const user = userEvent.setup();
  await section().findByRole("img", { name: "Accueil" });
  const buttons = section().getAllByRole("button", { name: "Plein écran" });
  const opener = buttons[1];
  if (!opener) throw new Error("the second frame has a fullscreen button");
  await waitFor(() => expect(opener.hasAttribute("disabled")).toBe(false));
  await user.click(opener);
  const dialog = await screen.findByRole("dialog", { name: "Accueil" });
  expect(within(dialog).getByText("SILO-45")).toBeTruthy();
  expect(within(dialog).getByText("2 / 2")).toBeTruthy();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("dialog", { name: "Tickets" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /^(Tickets|Accueil)$/ })).toBeNull());
  expect(screen.getByRole("dialog", { name: /SILO-45/ })).toBeTruthy();
  expect(document.activeElement).toBe(opener);
});

test("the thumbnail itself opens the view", async () => {
  show();
  const thumbnail = await section().findByRole("button", { name: "Plein écran · Tickets" });
  await waitFor(() => expect(thumbnail.hasAttribute("disabled")).toBe(false));
  await userEvent.setup().click(thumbnail);
  expect(await screen.findByRole("dialog", { name: "Tickets" })).toBeTruthy();
});

test("refresh in fullscreen refreshes the thumbnail too", async () => {
  show();
  const user = userEvent.setup();
  const thumbnail = await section().findByRole("button", { name: "Plein écran · Tickets" });
  await waitFor(() => expect(thumbnail.hasAttribute("disabled")).toBe(false));
  await user.click(thumbnail);
  const dialog = await screen.findByRole("dialog", { name: "Tickets" });
  replies[FIGMA_URL] = ready(FIGMA_URL, { stale: true });
  await user.click(within(dialog).getByRole("button", { name: "Actualiser" }));
  await waitFor(() => expect(within(dialog).getByText("Périmé")).toBeTruthy());
  expect(frameCalls()).toContainEqual({ method: "getDesignFrame", url: FIGMA_URL, refresh: true });
  expect(section().getByText("Périmé")).toBeTruthy();
});
