import { beforeEach, expect, mock, test } from "bun:test";
import { EditorView } from "@codemirror/view";
import type { FileVersion, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const version = (id: string, over: Partial<FileVersion>): FileVersion => ({
  id,
  kind: "agents",
  ref: "global:livraison",
  file: "agent.md",
  hash: `hash-${id}`,
  size: 3_800,
  at: Date.UTC(2026, 9, 11, 8, 5),
  origin: "kibo",
  by: "adam",
  note: null,
  missing: false,
  ...over,
});

const VERSIONS = [
  version("v3", { origin: "integrate", note: "review intégrée", size: 4_100 }),
  version("v2", { origin: "external", by: null, size: 3_900 }),
  version("v1", { origin: "kibo" }),
  version("v0", { origin: "migration", missing: true }),
];
const calls: RpcRequest[] = [];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "fileVersions.list") return Promise.resolve(VERSIONS);
        if (req.method === "fileVersions.read") {
          const found = VERSIONS.find((v) => v.id === req.id);
          return Promise.resolve({ version: found, content: found?.missing ? null : "# Ancien\n" });
        }
        return Promise.resolve(null);
      },
    },
  }),
);

const { VersionHistory } = await import("./VersionHistory");

beforeEach(() => {
  calls.length = 0;
});

const show = (onRestore = mock((_: string) => Promise.resolve(true))) => {
  render(
    <VersionHistory
      open
      onClose={() => {}}
      title="livraison"
      kind="agents"
      versionRef="global:livraison"
      currentContent={"# Actuel\n"}
      currentHash="hash-v3"
      onRestore={onRestore}
    />,
  );
  return onRestore;
};

const views = () =>
  Array.from(document.querySelectorAll(".cm-editor")).flatMap((dom) => {
    const view = dom instanceof HTMLElement ? EditorView.findFromDOM(dom) : null;
    return view ? [view] : [];
  });

test("the history lists versions with origin, author and size", async () => {
  show();
  const list = await screen.findByRole("list", { name: "Versions" });
  const items = within(list).getAllByRole("button");
  expect(items.map((i) => i.textContent?.replace(/^\d+ \S+ \d\d:\d\d/, ""))).toEqual([
    "Intégrationactuelleadam · review intégrée4,1 Ko",
    "Externemodifié hors de Kibo3,9 Ko",
    "Kiboadam3,8 Ko",
    "Migrationadam3,8 Ko",
  ]);
  expect(calls[0]).toEqual({ method: "fileVersions.list", kind: "agents", ref: "global:livraison" });
});

test("picking a version shows its diff against the current content and restores it", async () => {
  const onRestore = show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Kibo\s*adam/ }));
  await waitFor(() => expect(views().map((v) => v.state.doc.toString())).toEqual(["# Actuel\n"]));
  expect(views()[0]?.state.readOnly).toBe(true);
  await user.click(screen.getByRole("button", { name: "Restaurer cette version" }));
  expect(onRestore).toHaveBeenCalledWith("v1");
});

test("a version without content says so and cannot be restored", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Migration/ }));
  expect(await screen.findByText("contenu de version manquant")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Restaurer cette version" })).toBeNull();
});
