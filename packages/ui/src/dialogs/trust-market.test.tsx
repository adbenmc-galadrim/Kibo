import { expect, mock, test } from "bun:test";
import { NO_PERMISSIONS, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { apiMock } from "../api-mock";

mock.module("../api", () => apiMock({ client: { rpc: (_: RpcRequest) => Promise.resolve(null) } }));
const { TrustDialog, trustTargetOfInstall } = await import("./TrustDialog");

const result = (verified: boolean, newPublisher: boolean) => ({
  id: "milestones",
  title: "Calendrier des jalons",
  version: "1.2.0",
  hash: "c21e".repeat(16),
  permissions: NO_PERMISSIONS,
  market: { publisherName: "Léa", verified, sourceName: "Équipe", newPublisher },
});
const open = (target: ReturnType<typeof trustTargetOfInstall>) =>
  render(<TrustDialog target={target} mode="approve" open onOpenChange={() => {}} onApproved={() => {}} />);

test("a verified marketplace component names its publisher and source", () => {
  open(trustTargetOfInstall(result(true, true)));
  expect(screen.getByText("Autoriser « Calendrier des jalons » 1.2.0 ?")).toBeTruthy();
  expect(screen.getByText("Publié par Léa · vérifié par Équipe")).toBeTruthy();
  expect(screen.getByText("Nouvel éditeur")).toBeTruthy();
  expect(screen.getByText("Ce code vient d'une marketplace.")).toBeTruthy();
});

test("an unverified publisher is announced as such", () => {
  open(trustTargetOfInstall(result(false, false)));
  expect(screen.getByText("Publié par Léa · éditeur non vérifié")).toBeTruthy();
  expect(screen.queryByText("Nouvel éditeur")).toBeNull();
});

test("the marketplace dialog still preselects the sandboxed level", () => {
  open(trustTargetOfInstall(result(true, false)));
  expect(screen.getByRole("radio", { name: "Isolé (recommandé)" }).getAttribute("data-state")).toBe(
    "checked",
  );
});

test("a local component keeps the phase 4 dialog", () => {
  open({
    id: "hello",
    title: "Hello",
    version: "0.1.0",
    hash: "a".repeat(64),
    origin: "user",
    permissions: NO_PERMISSIONS,
  });
  expect(screen.queryByText("Ce code vient d'une marketplace.")).toBeNull();
  expect(screen.getByText(/Composant écrit par toi/)).toBeTruthy();
});
