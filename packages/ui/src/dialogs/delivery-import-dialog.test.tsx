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
const SILO: DeliveryImportCandidate = {
  name: "silo",
  repo: "/Users/adam/Documents/silo/silo-location",
  remote: "silo-labs/silo-location",
  matched: "silo",
  preview: {
    worktree: {
      baseRef: "origin/dev",
      pathTemplate: "../silo-{slug}",
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
      root: "/Users/adam/Documents/silo",
      profile: "/Users/adam/.claude/skills/full-delivery/projects/silo.md",
      publication: "draft",
      allow: ["Bash(pnpm *)", "Bash(docker compose *)"],
      addDirs: ["/Users/adam/Documents/silo", "/Users/adam/Documents/silo/memory"],
    },
  },
  notices: ["Règle refusée et omise : Bash(sh -c *)"],
};
const ATLAS: DeliveryImportCandidate = { ...SILO, name: "atlas", matched: null };
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
  candidates = [ATLAS, SILO];
  meta = {
    id: "silo",
    key: "SILO",
    name: "Silo",
    folder: SILO.repo,
    color: "#F97316",
    worktree: SILO.preview.worktree,
    storybook: null,
    duplication: null,
    delivery: SILO.preview.delivery,
    tracking: null,
    description: null,
    client: null,
  };
});

const draw = () => {
  const imported = mock((_: ProjectMeta) => {});
  render(
    <DeliveryImportDialog
      projectId="silo"
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
  const candidate = await d.findByRole("radio", { name: /silo/ });
  expect(candidate.getAttribute("aria-checked")).toBe("true");
  expect(d.getByText("correspond à ce projet")).toBeTruthy();
  expect(d.queryByRole("radio", { name: /atlas/ })).toBeNull();
  const rows = within(d.getByRole("table", { name: "Aperçu" }))
    .getAllByRole("row")
    .map((r) =>
      Array.from(r.querySelectorAll("td"))
        .map((c) => c.textContent)
        .filter((text) => text !== ""),
    );
  expect(rows).toContainEqual(["Base des worktrees", "main", "origin/dev"]);
  expect(rows).toContainEqual(["Chemin", ".kibo/worktrees/{slug}", "../silo-{slug}"]);
  expect(rows).toContainEqual(["Recette", "aucune", ".env copié · WEB_PORT, SERVER_PORT · pnpm install"]);
  expect(rows).toContainEqual(["Profil", "—", "~/.claude/skills/full-delivery/projects/silo.md"]);
  expect(rows).toContainEqual(["Publication", "—", "Brouillon (draft)"]);
  expect(rows).toContainEqual(["Règles", "aucune", "2 règles"]);
  expect(rows).toContainEqual(["Dossiers", "aucune", "~/Documents/silo, ~/Documents/silo/memory"]);
  expect(d.getByText("Règle refusée et omise : Bash(sh -c *)")).toBeTruthy();
  await userEvent.setup().click(d.getByRole("button", { name: "Importer" }));
  expect(calls.at(-1)).toEqual({
    method: "projects.applyDeliveryImport",
    projectId: "silo",
    name: "silo",
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
  candidates = [ATLAS];
  draw();
  const d = await dialog();
  expect(await d.findByText("Aucun projet du registre n'a ce dossier")).toBeTruthy();
  expect(d.getByRole("button", { name: "Importer" }).hasAttribute("disabled")).toBe(true);
});
