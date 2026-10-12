import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { EditorView } from "@codemirror/view";
import type { OverlapRpcResult, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { readFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let read: OverlapRpcResult["overlaps.read"] = readFixture();
let wide = true;
const originalMatchMedia = window.matchMedia;

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "overlaps.read") return Promise.resolve(read);
        return Promise.reject(new Error(`unexpected ${req.method}`));
      },
    },
  }),
);

const { OverlapFilesDialog } = await import("./OverlapFilesDialog");

const views = () =>
  Array.from(document.querySelectorAll(".cm-editor")).flatMap((dom) => {
    const view = dom instanceof HTMLElement ? EditorView.findFromDOM(dom) : null;
    return view ? [view] : [];
  });

beforeEach(() => {
  calls.length = 0;
  read = readFixture();
  wide = true;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("min-width") ? wide : !wide,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

test("both files are read and shown side by side, read only, the owner first", async () => {
  render(<OverlapFilesDialog overlapId="o1" onClose={() => {}} />);
  expect(await screen.findByText("bou · livraison · BOU-12 · src/lib/format.ts")).toBeTruthy();
  expect(screen.getByText("bou · livraison · BOU-15 · src/utils/date.ts")).toBeTruthy();
  expect(calls).toEqual([{ method: "overlaps.read", id: "o1" }]);
  await waitFor(() => expect(views()).toHaveLength(2));
  expect(views().map((v) => [v.state.doc.toString(), v.state.readOnly])).toEqual([
    [read.owner.content ?? "", true],
    [read.other.content ?? "", true],
  ]);
});

test("a narrow screen shows a single unified view", async () => {
  wide = false;
  render(<OverlapFilesDialog overlapId="o1" onClose={() => {}} />);
  await screen.findByText("bou · livraison · BOU-12 · src/lib/format.ts");
  await waitFor(() => expect(views()).toHaveLength(1));
  expect(views()[0]?.state.doc.toString()).toBe(read.other.content ?? "");
});

test("a missing file says so", async () => {
  read = { ...readFixture(), owner: { ...readFixture().owner, content: null, reason: "fichier supprimé" } };
  render(<OverlapFilesDialog overlapId="o1" onClose={() => {}} />);
  expect(await screen.findByText("fichier absent")).toBeTruthy();
});

test("the dialog closes", async () => {
  const closed: string[] = [];
  render(<OverlapFilesDialog overlapId="o1" onClose={() => closed.push("x")} />);
  await screen.findByText("bou · livraison · BOU-12 · src/lib/format.ts");
  await userEvent.setup().click(screen.getByRole("button", { name: "Fermer" }));
  expect(closed.length).toBeGreaterThan(0);
});
