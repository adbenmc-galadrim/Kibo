import { beforeEach, expect, mock, test } from "bun:test";
import type { ParallelWork, RpcRequest } from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { type Host, HostProvider } from "../shell/Host";
import {
  OTHER_RUN,
  OWNER_NAME,
  OWNER_RUN,
  parallelFixture,
  parallelRunFixture,
  readFixture,
} from "./fixtures";

const calls: RpcRequest[] = [];
const topics: (() => void)[] = [];
let work: ParallelWork = parallelFixture();

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "overlaps.parallel") return Promise.resolve(work);
        if (req.method === "overlaps.read") return Promise.resolve(readFixture());
        return Promise.reject(new Error(`unexpected ${req.method}`));
      },
      subscribeTopic: (_: string, fire: () => void) => {
        topics.push(fire);
        return () => {
          topics.splice(topics.indexOf(fire), 1);
        };
      },
    },
  }),
);

const { ParallelWorkSection } = await import("./ParallelWorkSection");

const opened: string[] = [];
const host: Host = {
  openTicket: () => {},
  openNewTicket: () => {},
  openAssign: () => {},
  openFile: () => {},
  openView: () => {},
  openTarget: () => {},
  openRun: (runId) => opened.push(runId),
};

const renderSection = () =>
  render(
    <HostProvider host={host}>
      <ParallelWorkSection runId={OTHER_RUN} />
    </HostProvider>,
  );

beforeEach(() => {
  calls.length = 0;
  topics.length = 0;
  opened.length = 0;
  work = parallelFixture();
});

test("screen 200: each other run shows its mention, step, files, new exports and overlaps", async () => {
  renderSection();
  const section = await screen.findByRole("region", { name: "Travail en parallèle" });
  const card = within(section);
  expect(calls).toEqual([{ method: "overlaps.parallel", runId: OTHER_RUN }]);
  expect(await card.findByRole("button", { name: OWNER_NAME })).toBeTruthy();
  expect(card.getByText("1 run actif")).toBeTruthy();
  expect(card.getByText(/Brancher le format sur le récapitulatif/)).toBeTruthy();
  expect(card.getByText("worktree bou-12")).toBeTruthy();
  expect(card.queryByText("src/lib/format.ts")).toBeNull();
  await userEvent.setup().click(card.getByRole("button", { name: /3 fichiers/ }));
  const file = card.getByText("src/lib/format.ts").closest("li");
  expect(file?.textContent).toContain("+3");
  expect(file?.textContent).toContain("−1");
  expect(card.getByText("2 exports nouveaux")).toBeTruthy();
  expect(card.getByText("formatDeliveryWindow")).toBeTruthy();
  const overlap = card
    .getByText("formatDate", { selector: "[data-overlap-row] code" })
    .closest("[data-overlap-row]");
  expect(overlap?.textContent).toContain("exporté deux fois");
  expect(overlap?.textContent).toContain("Ouvert");
});

test("a file this run changed too is marked, and only that one", async () => {
  work = parallelFixture({ sharedPaths: ["src/i18n/fr.ts", "src/elsewhere.ts"] });
  renderSection();
  await userEvent.setup().click(await screen.findByRole("button", { name: /3 fichiers/ }));
  const shared = screen.getByText("src/i18n/fr.ts").closest("li");
  expect(shared?.textContent).toContain("aussi modifié par toi");
  expect(screen.getAllByText("aussi modifié par toi")).toHaveLength(1);
  expect(screen.getByText("src/lib/format.ts").closest("li")?.textContent).not.toContain("aussi modifié");
});

test("without paths in common no file is marked", async () => {
  renderSection();
  await userEvent.setup().click(await screen.findByRole("button", { name: /3 fichiers/ }));
  expect(screen.queryByText("aussi modifié par toi")).toBeNull();
});

test("« Voir son travail » opens the other run, « Voir les fichiers » the two files", async () => {
  renderSection();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Voir son travail" }));
  expect(opened).toEqual([OWNER_RUN]);
  await user.click(screen.getByRole("button", { name: "Voir les fichiers" }));
  expect(await screen.findByText("bou · livraison · BOU-12 · src/lib/format.ts")).toBeTruthy();
});

test("a run in the project folder says the folder is shared", async () => {
  work = parallelFixture({ runs: [parallelRunFixture({ workspace: "shared", worktreeName: null })] });
  renderSection();
  expect(await screen.findByText("dossier du projet, partagé avec toi")).toBeTruthy();
});

test("without any other run the section says so, and a partial detection is noted", async () => {
  work = parallelFixture({ runs: [], overlaps: [], partial: true });
  renderSection();
  expect(await screen.findByText("Aucun autre run sur ce projet")).toBeTruthy();
  expect(screen.getByText("Détection partielle")).toBeTruthy();
});

test("the section is replayed on the agents topic", async () => {
  work = parallelFixture({ runs: [] });
  renderSection();
  await screen.findByText("Aucun autre run sur ce projet");
  work = parallelFixture();
  act(() => {
    for (const fire of topics) fire();
  });
  await waitFor(() => expect(screen.getByRole("button", { name: OWNER_NAME })).toBeTruthy());
});
