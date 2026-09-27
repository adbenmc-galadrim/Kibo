import { expect, mock, test } from "bun:test";
import { NO_PERMISSIONS, type PublishPreview, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";

const preview: PublishPreview = {
  id: "pr-queue",
  title: "PR en attente",
  from: "0.3.0",
  to: "0.4.0",
  hash: "b".repeat(64),
  status: "update",
  usages: [],
  changes: ["Filtre par auteur"],
  newPermissions: [],
  migration: null,
  validation: {
    manifest: { ok: true, errors: [] },
    imports: { ok: true, errors: [] },
    typecheck: { ok: true, errors: [] },
    tests: { ok: true, passed: 1, failed: 0, output: "" },
    conformance: { ok: true, errors: [] },
    permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
    hash: "b".repeat(64),
    ok: true,
  },
};
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => Promise.resolve(req.method === "previewPublish" ? preview : []),
    subscribe: () => () => undefined,
  },
}));
const { TrustDialog } = await import("./TrustDialog");
const { PublishDialog } = await import("../components-page/PublishDialog");

const LOCAL_ONLY = "Cette action n'est possible que depuis l'ordinateur où tourne Kibo.";
const target = {
  id: "burndown",
  title: "Burndown",
  version: "0.1.0",
  hash: "c".repeat(64),
  origin: "marketplace" as const,
  permissions: NO_PERMISSIONS,
};

test("approving is disabled from a remote session and says why", () => {
  render(
    <TrustDialog target={target} mode="approve" open onOpenChange={() => {}} onApproved={() => {}} remote />,
  );
  expect(screen.getByRole("button", { name: "Autoriser" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText(LOCAL_ONLY)).toBeTruthy();
});

test("publishing a local component is disabled from a remote session and says why", async () => {
  render(<PublishDialog id={preview.id} open onOpenChange={() => {}} remote />);
  expect((await screen.findByRole("button", { name: "Publier 0.4.0" })).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText(LOCAL_ONLY)).toBeTruthy();
});
