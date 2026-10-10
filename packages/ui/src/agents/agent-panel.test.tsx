import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { agentsFixture, NOW } from "./fixtures";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return outcome();
      },
      subscribeEvents: () => () => undefined,
      subscribeMoments: () => () => undefined,
      subscribe: () => () => undefined,
    },
  }),
);

mock.module("../state/use-agents", () => ({
  useAgents: () => agentsFixture(),
  useConfig: () => null,
  useNow: () => NOW,
  useRunLog: () => ({ log: null, missing: false, empty: false }),
  useDaemonOnline: () => true,
}));

const { AgentDock } = await import("./dock/AgentDock");
const { AgentPanel } = await import("./AgentPanel");
const { ReplyBox } = await import("./ReplyBox");

afterEach(() => window.sessionStorage.clear());

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

const actions = () => calls.filter((c) => c.method !== "getProject" && c.method !== "runMoments");

const run = (id: string) => {
  const found = agentsFixture().runs.find((r) => r.id === id);
  if (!found) throw new Error(`fixture ${id} missing`);
  return found;
};

const dock = (selected: string) => (
  <AgentDock
    state={agentsFixture()}
    now={NOW}
    online
    selected={run(selected)}
    onSelect={() => {}}
    onCollapse={() => {}}
    onLaunch={() => {}}
    onOpenFile={() => {}}
  />
);

test("stopping a run is confirmed, then cancels it, and a refusal is shown", async () => {
  render(dock("r42"));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Arrêter" }));
  const dialog = within(await screen.findByRole("alertdialog"));
  expect(dialog.getByText("Arrêter le run opus-dev-1 sur KIB-12 ?")).toBeTruthy();
  expect(dialog.getByText("L'agent est interrompu ; le ticket reste assigné.")).toBeTruthy();
  await user.click(dialog.getByRole("button", { name: "Annuler" }));
  expect(actions()).toEqual([]);
  await user.click(screen.getByRole("button", { name: "Arrêter" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Arrêter" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(actions()).toEqual([{ method: "cancelRun", runId: "r42" }]);
  outcome = () => Promise.reject(new KiboError("INVALID_TRANSITION", "run r42 is done"));
  await user.click(screen.getByRole("button", { name: "Arrêter" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Arrêter" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'arrêter le run.");
});
test("a finished run has no stop button", () => {
  render(dock("r40"));
  expect(screen.queryByRole("button", { name: "Arrêter" })).toBeNull();
});
test("the reply box sends a trimmed answer, and keeps the text when it fails", async () => {
  render(<ReplyBox run={run("r41")} />);
  const user = userEvent.setup();
  const field = screen.getByLabelText<HTMLInputElement>("Réponse à opus-dev-2");
  await user.type(field, "  Port dynamique, écrit dans ~/.kibo/daemon.json ");
  await user.click(screen.getByRole("button", { name: "Envoyer" }));
  expect(calls).toEqual([
    { method: "answerRun", runId: "r41", text: "Port dynamique, écrit dans ~/.kibo/daemon.json" },
  ]);
  await waitFor(() => expect(field.value).toBe(""));
  outcome = () => Promise.reject(new KiboError("INVALID_TRANSITION", "not waiting"));
  await user.type(field, "4747");
  await user.click(screen.getByRole("button", { name: "Envoyer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'envoyer la réponse.");
  expect(field.value).toBe("4747");
});
test("the panel opens on the waiting run, shows its feed and folds back", async () => {
  render(<AgentPanel onLaunch={() => {}} focusRunId={null} onFocused={() => {}} onOpenFile={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Répondre à opus-dev-2" }));
  expect(await screen.findByRole("region", { name: "Fil" })).toBeTruthy();
  expect(screen.getByLabelText("Réponse à opus-dev-2")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Replier les agents" }));
  expect(screen.getByRole("button", { name: "Déplier les agents" })).toBeTruthy();
});
test("the dock stays open for the session once unfolded", async () => {
  const view = render(
    <AgentPanel onLaunch={() => {}} focusRunId={null} onFocused={() => {}} onOpenFile={() => {}} />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Déplier les agents" }));
  expect(await screen.findByRole("region", { name: "Runs" })).toBeTruthy();
  expect(window.sessionStorage.getItem("kibo.agents.dock.open")).toBe("1");
  view.unmount();
  render(<AgentPanel onLaunch={() => {}} focusRunId={null} onFocused={() => {}} onOpenFile={() => {}} />);
  expect(await screen.findByRole("region", { name: "Runs" })).toBeTruthy();
});
test("a focus request opens the dock on that run", async () => {
  const onFocused = mock(() => {});
  render(<AgentPanel onLaunch={() => {}} focusRunId="r42" onFocused={onFocused} onOpenFile={() => {}} />);
  const runs = await screen.findByRole("region", { name: "Runs" });
  expect(within(runs).getByRole("button", { pressed: true }).textContent).toContain("opus-dev-1");
  expect(onFocused).toHaveBeenCalledTimes(1);
});
test("the launch button asks the shell to open the assign dialog", async () => {
  const onLaunch = mock(() => {});
  render(<AgentPanel onLaunch={onLaunch} focusRunId="r41" onFocused={() => {}} onOpenFile={() => {}} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Lancer un agent" }));
  expect(onLaunch).toHaveBeenCalled();
});
