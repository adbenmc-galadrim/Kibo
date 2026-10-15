import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_DUPLICATION_SETTINGS,
  DUPLICATION_SHARED_GLOBS,
  type DuplicationSettings,
  type OverlapIgnore,
  type RpcRequest,
} from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let ignored: OverlapIgnore[] = [];
const IGNORED: OverlapIgnore = {
  projectId: "bou",
  kind: "file",
  key: "src/i18n/fr.ts",
  label: "src/i18n/fr.ts",
  by: { kind: "human", ref: "adam" },
  at: new Date(2026, 9, 12, 14, 30).getTime(),
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "overlaps.ignored") return ignored;
        if (req.method === "overlaps.reactivate") {
          ignored = [];
          return { ok: true };
        }
        throw new Error(`unexpected ${req.method}`);
      },
    },
  }),
);

const { DuplicationFields } = await import("./DuplicationFields");

const changes: (DuplicationSettings | null)[] = [];
const draw = (value: DuplicationSettings | null = null, disabled = false) =>
  render(
    <DuplicationFields value={value} onChange={(v) => changes.push(v)} projectId="bou" disabled={disabled} />,
  );
const section = () => within(screen.getByRole("group", { name: "Doublons entre agents" }));

beforeEach(() => {
  calls.length = 0;
  changes.length = 0;
  ignored = [IGNORED];
});

test("screen 201: null shows the defaults with detection on", async () => {
  draw();
  const s = section();
  expect(
    s.getByRole("switch", { name: "Détecter les doublons entre agents" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect((s.getByRole("spinbutton", { name: "Lignes minimales d'un bloc" }) as HTMLInputElement).value).toBe(
    "8",
  );
  expect(s.getByRole("checkbox", { name: "Comparer aussi les tests" }).getAttribute("aria-checked")).toBe(
    "false",
  );
  expect((s.getByRole("textbox", { name: "Fichiers ignorés" }) as HTMLTextAreaElement).value).toBe("");
  const exports = within(s.getByRole("list", { name: "Exports génériques" }));
  expect(exports.getAllByRole("listitem")).toHaveLength(DEFAULT_DUPLICATION_SETTINGS.genericExports.length);
  expect(exports.getByRole("button", { name: "Retirer handler" })).toBeTruthy();
  expect(await s.findByText("src/i18n/fr.ts")).toBeTruthy();
  expect(s.getByText("fichier")).toBeTruthy();
  expect(s.getByText("12 oct. · Adam")).toBeTruthy();
  expect(calls).toContainEqual({ method: "overlaps.ignored", projectId: "bou" });
});

test("turning detection off sends the defaults with enabled false", async () => {
  draw();
  await userEvent
    .setup()
    .click(section().getByRole("switch", { name: "Détecter les doublons entre agents" }));
  expect(changes).toEqual([{ ...DEFAULT_DUPLICATION_SETTINGS, enabled: false }]);
});

test("min lines out of 4 to 50 is explained and not sent", () => {
  draw();
  const input = section().getByRole("spinbutton", { name: "Lignes minimales d'un bloc" });
  fireEvent.change(input, { target: { value: "3" } });
  expect(section().getByText("Choisis un nombre entre 4 et 50.")).toBeTruthy();
  expect(changes).toEqual([]);
  fireEvent.change(input, { target: { value: "12" } });
  expect(changes).toEqual([{ ...DEFAULT_DUPLICATION_SETTINGS, minLines: 12 }]);
  expect(section().queryByText("Choisis un nombre entre 4 et 50.")).toBeNull();
});

test("comparing tests is a checkbox", async () => {
  draw();
  await userEvent.setup().click(section().getByRole("checkbox", { name: "Comparer aussi les tests" }));
  expect(changes).toEqual([{ ...DEFAULT_DUPLICATION_SETTINGS, compareTests: true }]);
});

test("ignored files are one glob per line, 50 at most", () => {
  draw();
  const area = section().getByRole("textbox", { name: "Fichiers ignorés" });
  fireEvent.change(area, { target: { value: "src/generated/**\n\n  *.gen.ts  \n" } });
  expect(changes.at(-1)).toEqual({
    ...DEFAULT_DUPLICATION_SETTINGS,
    ignore: ["src/generated/**", "*.gen.ts"],
  });
  const many = Array.from({ length: 51 }, (_, i) => `dir${i}/**`).join("\n");
  fireEvent.change(area, { target: { value: many } });
  expect(section().getByText("50 globs au plus.")).toBeTruthy();
  expect(changes).toHaveLength(1);
});

test("screen 215: shared files are prefilled, one glob per line, and saved as typed", () => {
  draw();
  const area = section().getByRole("textbox", { name: "Fichiers partagés" }) as HTMLTextAreaElement;
  expect(area.value).toBe(DUPLICATION_SHARED_GLOBS.join("\n"));
  fireEvent.change(area, { target: { value: "*.md\n\n  **/i18n/**  \n" } });
  expect(changes.at(-1)).toEqual({ ...DEFAULT_DUPLICATION_SETTINGS, shared: ["*.md", "**/i18n/**"] });
  fireEvent.change(area, { target: { value: "x".repeat(201) } });
  expect(section().getByText("Un glob fait 200 caractères au plus.")).toBeTruthy();
  expect(changes).toHaveLength(1);
});

test("a stored setting from before shared files shows the defaults", () => {
  const { shared: _shared, ...older } = DEFAULT_DUPLICATION_SETTINGS;
  draw({ ...older, compareTests: true });
  const area = section().getByRole("textbox", { name: "Fichiers partagés" }) as HTMLTextAreaElement;
  expect(area.value).toBe(DUPLICATION_SHARED_GLOBS.join("\n"));
});

test("generic exports are removable chips with an input to add, 100 at most", async () => {
  const user = userEvent.setup();
  draw();
  await user.click(section().getByRole("button", { name: "Retirer handler" }));
  expect(changes.at(-1)?.genericExports).not.toContain("handler");
  await user.type(section().getByRole("textbox", { name: "Ajouter un export générique" }), "toDate{Enter}");
  expect(changes.at(-1)?.genericExports.at(-1)).toBe("toDate");
  changes.length = 0;
  const full = {
    ...DEFAULT_DUPLICATION_SETTINGS,
    genericExports: Array.from({ length: 100 }, (_, i) => `name${i}`),
  };
  draw(full);
  const inputs = screen.getAllByRole("textbox", { name: "Ajouter un export générique" });
  await user.type(inputs.at(-1) as HTMLElement, "extra{Enter}");
  expect(screen.getByText("100 exports au plus.")).toBeTruthy();
  expect(changes).toEqual([]);
});

test("back to the defaults sends null, nothing stored", async () => {
  draw({ ...DEFAULT_DUPLICATION_SETTINGS, compareTests: true });
  await userEvent.setup().click(section().getByRole("checkbox", { name: "Comparer aussi les tests" }));
  expect(changes).toEqual([null]);
});

test("reactivating an ignored overlap calls the daemon then reloads the list", async () => {
  draw();
  const s = section();
  await userEvent.setup().click(await s.findByRole("button", { name: "Réactiver src/i18n/fr.ts" }));
  expect(calls).toContainEqual({
    method: "overlaps.reactivate",
    projectId: "bou",
    kind: "file",
    key: "src/i18n/fr.ts",
  });
  await waitFor(() => expect(s.getByText("Aucun")).toBeTruthy());
  expect(calls.filter((c) => c.method === "overlaps.ignored")).toHaveLength(2);
});

test("a remote project greys every field with the local note", async () => {
  draw(null, true);
  const s = section();
  expect(s.getByRole("switch").hasAttribute("disabled")).toBe(true);
  expect((s.getByRole("spinbutton") as HTMLInputElement).disabled).toBe(true);
  expect(s.getByRole("checkbox").hasAttribute("disabled")).toBe(true);
  expect((s.getByRole("textbox", { name: "Fichiers ignorés" }) as HTMLTextAreaElement).disabled).toBe(true);
  expect(s.getByRole("button", { name: "Retirer handler" }).hasAttribute("disabled")).toBe(true);
  expect(s.getByText("Réglage local : il se modifie sur l'ordinateur où tourne Kibo.")).toBeTruthy();
  expect((await s.findByRole("button", { name: "Réactiver src/i18n/fr.ts" })).hasAttribute("disabled")).toBe(
    true,
  );
});
