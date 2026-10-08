import { beforeEach, expect, mock, test } from "bun:test";
import type { AgentsState, AiEvent, ComponentDraft, RpcRequest, TabTarget } from "@kibo/schema";
import { SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, NOW, runFixture } from "../agents/fixtures";
import { draftFixture } from "../ai/draft-fixtures";
import { apiMock } from "../api-mock";

let drafts: ComponentDraft[] = [];
const aiListeners = new Set<(e: AiEvent) => void>();
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => (req.method === "listComponentDrafts" ? drafts : null),
      subscribeAi: (l: (e: AiEvent) => void) => {
        aiListeners.add(l);
        return () => aiListeners.delete(l);
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { ShellHeader } = await import("./ShellHeader");

const review = draftFixture({ id: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11", status: "review", runId: null });
const generating = draftFixture({
  id: "1c6d2f4e-8b62-4e3b-8d2f-3a1e7a2c9b22",
  status: "generating",
  runId: "r9",
});
const agents = (): AgentsState => ({
  ...agentsFixture(),
  runs: [runFixture({ id: "r9", state: "running" })],
});

function header(onOpen: (t: TabTarget) => void = () => {}) {
  return render(
    <SidebarProvider>
      <ShellHeader
        active={null}
        screen={null}
        project={null}
        ticketProject={null}
        branch={null}
        gitError={null}
        agents={agents()}
        viewer="adam"
        notifications="browser"
        now={NOW}
        onNewProfile={() => {}}
        onNewTicket={() => {}}
        onShare={() => {}}
        onOpenRun={() => {}}
        onOpen={onOpen}
        onHelp={() => {}}
      />
    </SidebarProvider>,
  );
}

beforeEach(() => {
  drafts = [];
  aiListeners.clear();
});

test("screen 131: without an active creation there is no Créations button", async () => {
  drafts = [draftFixture({ status: "done" })];
  header();
  await waitFor(() => expect(screen.getByRole("button", { name: /Historique des runs/ })).toBeTruthy());
  await act(async () => {});
  expect(screen.queryByRole("button", { name: /^Créations/ })).toBeNull();
});

test("screen 131: the button counts awaiting creations, pulses while one generates and opens the screen", async () => {
  drafts = [review, generating];
  const opened: TabTarget[] = [];
  header((t) => opened.push(t));
  const button = await screen.findByRole("button", { name: "Créations · 1 attend une action, 1 en cours" });
  expect(button.textContent).toBe("1");
  expect(button.getAttribute("data-busy")).toBe("true");
  await userEvent.setup().click(button);
  expect(opened).toEqual([{ kind: "screen", screen: "creations" }]);
});

test("the indicator follows draft.changed and disappears once every creation is finished", async () => {
  drafts = [review];
  header();
  expect(await screen.findByRole("button", { name: "Créations · 1 attend une action" })).toBeTruthy();
  drafts = [{ ...review, status: "done" }];
  await act(async () => {
    for (const l of aiListeners) l({ type: "draft.changed", draftId: review.id, status: "done" });
  });
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Créations/ })).toBeNull());
});
