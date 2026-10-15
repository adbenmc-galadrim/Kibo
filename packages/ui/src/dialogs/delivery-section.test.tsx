import { beforeEach, expect, mock, test } from "bun:test";
import { type AgentSummary, EMPTY_DELIVERY, type ProjectDelivery, type RpcRequest } from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { summaryFixture, systemSummaryFixture } from "../agents/catalog/fixtures";
import { apiMock } from "../api-mock";
import { appInfoFixture } from "../lib/app-info-fixture";

let agents: AgentSummary[] = [];
let userHome: string | null = "/Users/adam";
const AGENTS = [
  summaryFixture({ name: "full-delivery" }),
  summaryFixture({ name: "emis-livraison" }),
  summaryFixture({ name: "review-pr", settings: { enabled: false } }),
  systemSummaryFixture("assistant"),
];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        if (req.method === "getAppInfo") return appInfoFixture(userHome);
        if (req.method === "agents.list") return { agents, notices: [], partialWatch: false };
        throw new Error(`unexpected ${req.method}`);
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { DeliverySection } = await import("./DeliverySection");

const EMIS: ProjectDelivery = {
  ...EMPTY_DELIVERY,
  root: "/Users/adam/Documents/emis",
  profile: "/Users/adam/.claude/skills/full-delivery/projects/emis.md",
  idPattern: "^C\\d+(-\\d+)?$",
  publication: "draft",
  allow: ["Bash(pnpm *)"],
  addDirs: ["/Users/adam/Documents/emis"],
};

const draw = (value: ProjectDelivery | null = EMIS) => {
  const changes: (ProjectDelivery | null)[] = [];
  const problems: (string | null)[] = [];
  render(
    <DeliverySection
      value={value}
      worktree={null}
      projectId="emis"
      disabled={false}
      onChange={(next) => changes.push(next)}
      onProblem={(p) => problems.push(p)}
      onImported={() => {}}
    />,
  );
  return { changes, problems };
};
const section = async () => within(await screen.findByRole("group", { name: "Livraison" }));
const field = async (name: string) => (await section()).getByRole("textbox", { name }) as HTMLInputElement;

beforeEach(() => {
  agents = AGENTS;
  userHome = "/Users/adam";
});

test("a session without a user home refuses the folders with its reason, never ~/.kibo", async () => {
  userHome = null;
  draw();
  const s = await section();
  expect(
    await s.findByText(
      "Dossier personnel inconnu de cette session : les dossiers ne se règlent que sur la machine de Kibo.",
    ),
  ).toBeTruthy();
  expect(s.queryByRole("textbox", { name: "Dossier de travail du skill" })).toBeNull();
  expect(s.getByRole("button", { name: "Importer depuis full-delivery" }).hasAttribute("disabled")).toBe(
    true,
  );
});

test("screen 215: the delivery section shows every field of the project's settings", async () => {
  draw();
  const s = await section();
  await waitFor(() =>
    expect(s.getByRole("combobox", { name: "Agent de livraison" }).textContent).toBe(
      "full-delivery (par défaut)",
    ),
  );
  expect((await field("Dossier de travail du skill")).value).toBe("~/Documents/emis");
  expect((await field("Profil")).value).toBe("~/.claude/skills/full-delivery/projects/emis.md");
  for (const name of ["Mémoire", "Briefs", "Rapports", "TODO"]) expect((await field(name)).value).toBe("");
  expect((await field("Format des identifiants")).value).toBe("^C\\d+(-\\d+)?$");
  expect(s.getByRole("combobox", { name: "Publication" }).textContent).toBe("Brouillon (draft)");
  expect((await field("Règles ajoutées aux runs")).value).toBe("Bash(pnpm *)");
  expect((await field("Dossiers supplémentaires")).value).toBe("~/Documents/emis");
  expect(s.getByRole("button", { name: "Importer depuis full-delivery" })).toBeTruthy();
});

test("the delivery agent lists the assignable agents after the default", async () => {
  const { changes } = draw();
  const s = await section();
  const user = userEvent.setup();
  s.getByRole("combobox", { name: "Agent de livraison" }).focus();
  await user.keyboard("{Enter}");
  const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
  expect(options).toEqual(["full-delivery (par défaut)", "full-delivery", "emis-livraison"]);
  await user.click(screen.getByRole("option", { name: "emis-livraison" }));
  expect(changes.at(-1)?.agent).toBe("global:emis-livraison");
});

test("without a global full-delivery agent, no agent reads « Aucun »", async () => {
  agents = AGENTS.filter((a) => a.name !== "full-delivery");
  draw(null);
  const s = await section();
  await waitFor(() =>
    expect(s.getByRole("combobox", { name: "Agent de livraison" }).textContent).toBe("Aucun"),
  );
});

test("a tilde is expanded when the path is saved", async () => {
  const { changes } = draw(null);
  fireEvent.change(await field("Mémoire"), { target: { value: "~/Documents/emis/memory/MEMORY.md" } });
  expect(changes.at(-1)).toEqual({
    ...EMPTY_DELIVERY,
    memory: "/Users/adam/Documents/emis/memory/MEMORY.md",
  });
});

test("a relative path or a broken pattern is explained and not sent", async () => {
  const { changes, problems } = draw();
  fireEvent.change(await field("Briefs"), { target: { value: "briefs" } });
  const s = await section();
  expect(s.getByText("Briefs : un chemin absolu, ~ accepté.")).toBeTruthy();
  expect(problems.at(-1)).toBe("Briefs : un chemin absolu, ~ accepté.");
  fireEvent.change(await field("Briefs"), { target: { value: "" } });
  fireEvent.change(await field("Format des identifiants"), { target: { value: "^C(" } });
  expect(s.getByText(/n'est pas une expression régulière valide/)).toBeTruthy();
  expect(changes).toHaveLength(1);
});

test("rules are refused with the text of the agent rules", async () => {
  const { changes, problems } = draw();
  fireEvent.change(await field("Règles ajoutées aux runs"), { target: { value: "Bash(pnpm *)\nBash" } });
  const message = "Une règle Bash doit porter un motif : Bash(pnpm *).";
  expect((await section()).getByText(message)).toBeTruthy();
  expect(problems.at(-1)).toBe(message);
  expect(changes).toEqual([]);
});

test("emptying every field stores nothing", async () => {
  const { changes } = draw({ ...EMPTY_DELIVERY, root: "/Users/adam/Documents/emis" });
  fireEvent.change(await field("Dossier de travail du skill"), { target: { value: "" } });
  expect(changes.at(-1)).toBeNull();
});
