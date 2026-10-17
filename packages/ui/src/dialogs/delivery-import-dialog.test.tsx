import { beforeEach, expect, mock, test } from "bun:test";
import {
  type DeliveryImportCandidate,
  EMPTY_DELIVERY,
  type ProjectMeta,
  type RpcRequest,
  WORKTREE_DEFAULTS,
} from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const REGISTRY = "/Users/adam/.claude/skills/full-delivery/projects/registry.json";
const EMIS: DeliveryImportCandidate = {
  name: "emis",
  repo: "/Users/adam/Documents/emis/emis-suivi-chantier",
  remote: "adam/emis",
  matched: "emis",
  preview: {
    worktree: {
      baseRef: "origin/dev",
      pathTemplate: "../emis-{slug}",
      setup: null,
      recipe: {
        copyFrom: ["{sibling}"],
        copy: [".env"],
        env: {
          file: ".env",
          ports: { keys: { WEB_PORT: 3000, SERVER_PORT: 4000 }, from: 1, step: 10, count: 50 },
          replace: {},
          set: {},
        },
        after: ["pnpm install"],
      },
    },
    delivery: {
      ...EMPTY_DELIVERY,
      root: "/Users/adam/Documents/emis",
      profile: "/Users/adam/.claude/skills/full-delivery/projects/emis.md",
      publication: "draft",
      allow: ["Bash(pnpm *)", "Bash(docker compose *)"],
      addDirs: ["/Users/adam/Documents/emis", "/Users/adam/Documents/emis/memory"],
    },
  },
  notices: ["Règle refusée et omise : Bash(sh -c *)"],
};
const GERECO: DeliveryImportCandidate = { ...EMIS, name: "gereco", matched: null };
const calls: RpcRequest[] = [];
let candidates: DeliveryImportCandidate[] = [];
let meta: ProjectMeta;

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "projects.importDelivery")
          return { registryPath: req.registryPath ?? REGISTRY, candidates };
        if (req.method === "projects.applyDeliveryImport") return meta;
        throw new Error(`unexpected ${req.method}`);
      },
    },
  }),
);

const { DeliveryImportDialog } = await import("./DeliveryImportDialog");

beforeEach(() => {
  calls.length = 0;
  candidates = [GERECO, EMIS];
  meta = {
    id: "emis",
    key: "EMIS",
    name: "Emis",
    folder: EMIS.repo,
    color: "#F97316",
    worktree: EMIS.preview.worktree,
    storybook: null,
    duplication: null,
    delivery: EMIS.preview.delivery,
    tracking: null,
    description: null,
  };
});

const draw = () => {
  const imported = mock((_: ProjectMeta) => {});
  render(
    <DeliveryImportDialog
      projectId="emis"
      home="/Users/adam"
      current={{ worktree: WORKTREE_DEFAULTS, delivery: null }}
      onClose={() => {}}
      onImported={imported}
    />,
  );
  return imported;
};
const dialog = async () =>
  within(await screen.findByRole("dialog", { name: "Importer depuis full-delivery" }));

test("screen 215b: the matching candidate with its preview, before → after, then Import", async () => {
  const imported = draw();
  const d = await dialog();
  expect(((await d.findByRole("textbox", { name: "Registre" })) as HTMLInputElement).value).toBe(
    "~/.claude/skills/full-delivery/projects/registry.json",
  );
  const candidate = await d.findByRole("radio", { name: /emis/ });
  expect(candidate.getAttribute("aria-checked")).toBe("true");
  expect(d.getByText("correspond à ce projet")).toBeTruthy();
  expect(d.queryByRole("radio", { name: /gereco/ })).toBeNull();
  const rows = within(d.getByRole("table", { name: "Aperçu" }))
    .getAllByRole("row")
    .map((r) =>
      Array.from(r.querySelectorAll("td"))
        .map((c) => c.textContent)
        .filter((text) => text !== ""),
    );
  expect(rows).toContainEqual(["Base des worktrees", "main", "origin/dev"]);
  expect(rows).toContainEqual(["Chemin", ".kibo/worktrees/{slug}", "../emis-{slug}"]);
  expect(rows).toContainEqual(["Recette", "aucune", ".env copié · WEB_PORT, SERVER_PORT · pnpm install"]);
  expect(rows).toContainEqual(["Profil", "—", "~/.claude/skills/full-delivery/projects/emis.md"]);
  expect(rows).toContainEqual(["Publication", "—", "Brouillon (draft)"]);
  expect(rows).toContainEqual(["Règles", "aucune", "2 règles"]);
  expect(rows).toContainEqual(["Dossiers", "aucune", "~/Documents/emis, ~/Documents/emis/memory"]);
  expect(d.getByText("Règle refusée et omise : Bash(sh -c *)")).toBeTruthy();
  await userEvent.setup().click(d.getByRole("button", { name: "Importer" }));
  expect(calls.at(-1)).toEqual({
    method: "projects.applyDeliveryImport",
    projectId: "emis",
    name: "emis",
    registryPath: REGISTRY,
  });
  await waitFor(() => expect(imported).toHaveBeenCalledWith(meta));
});

test("the registry path can be changed and read again, tilde expanded", async () => {
  draw();
  const d = await dialog();
  const field = await d.findByRole("textbox", { name: "Registre" });
  fireEvent.change(field, { target: { value: "~/registre.json" } });
  await userEvent.setup().click(d.getByRole("button", { name: "Relire" }));
  await waitFor(() =>
    expect(calls.at(-1)).toEqual({
      method: "projects.importDelivery",
      registryPath: "/Users/adam/registre.json",
    }),
  );
});

test("no candidate for this folder says so and cannot import", async () => {
  candidates = [GERECO];
  draw();
  const d = await dialog();
  expect(await d.findByText("Aucun projet du registre n'a ce dossier")).toBeTruthy();
  expect(d.getByRole("button", { name: "Importer" }).hasAttribute("disabled")).toBe(true);
});
