import { expect, mock, test } from "bun:test";
import type { ComponentVersionSummary, RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";

mock.module("../api", () => ({ client: { rpc: (_: RpcRequest) => Promise.resolve(null) } }));
const { PendingTrust } = await import("./PendingTrust");

const MILESTONES = "milestones";
const revoked: ComponentVersionSummary = {
  version: "1.0.3",
  hash: "a".repeat(64),
  trust: null,
  origin: "marketplace",
  active: false,
  tampered: false,
  manifest: null,
  usages: [],
  revoked: { reason: "calcul des échéances faux", at: 1 },
};

test("a revoked version shows its reason and cannot be approved again", () => {
  render(
    <PendingTrust
      id={MILESTONES}
      title="Calendrier des jalons"
      version="1.0.3"
      summary={revoked}
      tampered={false}
      compact
    />,
  );
  expect(screen.getByText("Révoqué : calcul des échéances faux")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Examiner et autoriser" }).hasAttribute("disabled")).toBe(true);
});
