import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "../i18n/fr";
import { agentsFixture, NOW } from "./fixtures";
import { RUN_LOG } from "./run-log-fixture";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return outcome();
    },
    subscribeEvents: () => () => undefined,
    subscribe: () => () => undefined,
  },
}));

mock.module("../state/use-agents", () => ({
  useAgents: () => agentsFixture(),
  useConfig: () => null,
  useNow: () => NOW,
  useRunLog: (runId: string | null) =>
    runId === "r40"
      ? { log: null, missing: true, empty: false }
      : { log: runId === "r41" ? RUN_LOG : runId ? [] : null, missing: false, empty: runId !== "r41" },
  useDaemonOnline: () => true,
}));

const { AgentBar } = await import("./AgentBar");
const { AgentDrawer } = await import("./AgentDrawer");
const { AgentPanel } = await import("./AgentPanel");
const { ReplyBox } = await import("./ReplyBox");

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

const actions = () => calls.filter((c) => c.method !== "getProject");

const run = (id: string) => {
  const found = agentsFixture().runs.find((r) => r.id === id);
  if (!found) throw new Error(`fixture ${id} missing`);
  return found;
};

test("the bar sums up slots, queue, running runs and the run waiting for an answer", async () => {
  const onSelect = mock((_: string) => {});
  const onExpand = mock(() => {});
  render(<AgentBar state={agentsFixture()} now={NOW} online onExpand={onExpand} onSelect={onSelect} />);
  expect(screen.getByText("3/3")).toBeTruthy();
  expect(screen.getByText("Kibo · connecté")).toBeTruthy();
  expect(screen.getByText("3 en file")).toBeTruthy();
  for (const label of ["opus-dev-1", "opus-dev-3", "sonnet-review-1"]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.getByText("KIB-12 · 12m")).toBeTruthy();
  expect(screen.getByText("KIB-7 · 1m")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Répondre à opus-dev-2" }));
  expect(onSelect).toHaveBeenCalledWith("r41");
  await user.click(screen.getByRole("button", { name: "Déplier les agents" }));
  expect(onExpand).toHaveBeenCalled();
});
test("the bar hides the runs that wrap behind a counter that expands the panel", async () => {
  const wrapped = new Set(["r43", "r44"]);
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get(this: HTMLElement) {
      return wrapped.has(this.dataset.run ?? "") ? 16 : 0;
    },
  });
  try {
    const onExpand = mock(() => {});
    render(<AgentBar state={agentsFixture()} now={NOW} online onExpand={onExpand} onSelect={() => {}} />);
    const counter = await screen.findByRole("button", { name: "2 autres runs en cours" });
    expect(counter.textContent).toBe("+2");
    const item = (label: string) => screen.getByText(label).closest("li");
    expect(item("opus-dev-1")?.getAttribute("aria-hidden")).toBeNull();
    for (const label of ["opus-dev-3", "sonnet-review-1"]) {
      expect(item(label)?.getAttribute("aria-hidden")).toBe("true");
      expect(item(label)?.querySelector("button")?.tabIndex).toBe(-1);
    }
    await userEvent.setup().click(counter);
    expect(onExpand).toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(HTMLElement.prototype, "offsetTop", original);
  }
});
test("the counter speaks of a single run in the singular", () => {
  expect(fr.agents.moreRuns(1)).toBe("1 autre run en cours");
});
test("the bar says when the daemon is out of reach", () => {
  render(
    <AgentBar state={agentsFixture()} now={NOW} online={false} onExpand={() => {}} onSelect={() => {}} />,
  );
  expect(screen.getByText("Kibo · hors ligne")).toBeTruthy();
  expect(screen.queryByText("Kibo · connecté")).toBeNull();
});
test("the drawer groups runs like the mockup and numbers the queue", async () => {
  const onSelect = mock((_: string) => {});
  render(
    <AgentDrawer
      state={agentsFixture()}
      now={NOW}
      selected={null}
      log={null}
      onSelect={onSelect}
      onCollapse={() => {}}
      onLaunch={() => {}}
      onOpenFile={() => {}}
    />,
  );
  expect(screen.getByText("3/3 places · 3 en file · 1 attend une réponse")).toBeTruthy();
  const running = within(screen.getByRole("list", { name: "En cours · 3/3 places" }));
  expect(running.getAllByRole("button").map((b) => b.textContent?.split("KIB")[0])).toEqual([
    "opus-dev-1",
    "opus-dev-3",
    "sonnet-review-1",
  ]);
  const queued = within(screen.getByRole("list", { name: "En file · 3" }));
  expect(queued.getByText("#1")).toBeTruthy();
  expect(queued.getByText("KIB-10 · Prioritaire")).toBeTruthy();
  expect(queued.getByText("KIB-29 · attend une place sur la machine (3/3)")).toBeTruthy();
  const finished = within(screen.getByRole("list", { name: "Terminé" }));
  expect(finished.getByText("KIB-11 · Terminé")).toBeTruthy();
  expect(finished.getByText("KIB-7 · Échec : exit code 1")).toBeTruthy();
  expect(screen.getByText("Choisis un run pour voir son journal.")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(
    within(screen.getByRole("list", { name: "Attend une réponse · place libérée" })).getByRole("button"),
  );
  expect(onSelect).toHaveBeenCalledWith("r41");
});
test("stopping a run is confirmed, then cancels it, and a refusal is shown", async () => {
  const props = {
    state: agentsFixture(),
    now: NOW,
    log: [],
    onSelect: () => {},
    onCollapse: () => {},
    onLaunch: () => {},
    onOpenFile: () => {},
  };
  render(<AgentDrawer {...props} selected={run("r42")} />);
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
  render(
    <AgentDrawer
      state={agentsFixture()}
      now={NOW}
      selected={run("r40")}
      log={[]}
      onSelect={() => {}}
      onCollapse={() => {}}
      onLaunch={() => {}}
      onOpenFile={() => {}}
    />,
  );
  expect(screen.queryByRole("button", { name: "Arrêter" })).toBeNull();
});
test("an empty journal is unavailable only once the run has ended; a gone journal always is", () => {
  const drawer = (id: string, log: { missing: boolean; empty: boolean }) => (
    <AgentDrawer
      state={agentsFixture()}
      now={NOW}
      selected={run(id)}
      log={[]}
      {...log}
      onSelect={() => {}}
      onCollapse={() => {}}
      onLaunch={() => {}}
      onOpenFile={() => {}}
    />
  );
  const view = render(drawer("r42", { missing: false, empty: true }));
  expect(screen.queryByText("Journal indisponible pour ce run.")).toBeNull();
  view.rerender(drawer("r40", { missing: false, empty: true }));
  expect(screen.getByText("Journal indisponible pour ce run.")).toBeTruthy();
  view.rerender(drawer("r42", { missing: true, empty: false }));
  expect(screen.getByText("Journal indisponible pour ce run.")).toBeTruthy();
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
test("the panel opens on the waiting run, shows its journal and folds back", async () => {
  render(<AgentPanel onLaunch={() => {}} focusRunId={null} onFocused={() => {}} onOpenFile={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Répondre à opus-dev-2" }));
  expect(await screen.findByRole("list", { name: "Journal de opus-dev-2" })).toBeTruthy();
  expect(screen.getByLabelText("Réponse à opus-dev-2")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Replier les agents" }));
  expect(screen.getByRole("button", { name: "Déplier les agents" })).toBeTruthy();
});
test("a focus request opens the drawer on that run", async () => {
  const onFocused = mock(() => {});
  render(<AgentPanel onLaunch={() => {}} focusRunId="r42" onFocused={onFocused} onOpenFile={() => {}} />);
  expect(await screen.findByRole("list", { name: "Journal de opus-dev-1" })).toBeTruthy();
  expect(onFocused).toHaveBeenCalledTimes(1);
});
test("a run whose journal is gone says so in the drawer", async () => {
  render(<AgentPanel onLaunch={() => {}} focusRunId="r40" onFocused={() => {}} onOpenFile={() => {}} />);
  expect(await screen.findByText("Journal indisponible pour ce run.")).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Journal de sonnet-review-1" })).toBeNull();
});
test("the launch button asks the shell to open the assign dialog", async () => {
  const onLaunch = mock(() => {});
  render(<AgentPanel onLaunch={onLaunch} focusRunId="r41" onFocused={() => {}} onOpenFile={() => {}} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Lancer un agent" }));
  expect(onLaunch).toHaveBeenCalled();
});
