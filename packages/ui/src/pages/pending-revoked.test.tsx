import { beforeEach, expect, mock, test } from "bun:test";
import type { ComponentVersionSummary, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(null);
      },
    },
  }),
);
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
  backend: false,
};
const pending = (others: string[]) =>
  render(
    <PendingTrust
      id={MILESTONES}
      title="Calendrier des jalons"
      version="1.0.3"
      summary={revoked}
      tampered={false}
      compact
      projectId="p1"
      instanceId="i1"
      others={others}
    />,
  );

beforeEach(() => {
  calls.length = 0;
});

test("a revoked version shows its reason and cannot be approved again", () => {
  pending([]);
  expect(screen.getByText("Révoqué : calcul des échéances faux")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Examiner et autoriser" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Choisir une autre version" })).toBeNull();
});

test("another installed version can be chosen for the instance", async () => {
  pending(["1.2.0", "1.0.2"]);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Choisir une autre version" }));
  expect(screen.getByRole("menuitem", { name: "Passer en 1.0.2" })).toBeTruthy();
  await user.click(screen.getByRole("menuitem", { name: "Passer en 1.2.0" }));
  await waitFor(() =>
    expect(calls).toEqual([{ method: "updateInstance", projectId: "p1", instanceId: "i1", to: "1.2.0" }]),
  );
});
