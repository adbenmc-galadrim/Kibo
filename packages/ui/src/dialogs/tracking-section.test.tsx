import { expect, mock, test } from "bun:test";
import type { ProjectSummary, RpcRequest, TrackingSettings } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { projectsFixture } from "../lib/fixtures";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      subscribe: () => () => {},
      subscribeTopic: () => () => {},
      subscribeEvents: () => () => {},
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "overlaps.ignored") return [];
        return null;
      },
    },
  }),
);

const { TrackingSection } = await import("./TrackingSection");
const { EditProjectDialog } = await import("./EditProjectDialog");

async function pick(user: ReturnType<typeof userEvent.setup>, value: string) {
  const limit = screen.getByRole("combobox", { name: "Limite de fonctionnalités ouvertes" });
  limit.focus();
  await user.keyboard("{Enter}");
  const options = await screen.findAllByRole("option");
  const option = options.find((o) => o.textContent === value);
  if (!option) throw new Error(`no option ${value}`);
  await user.click(option);
}

test("the limit defaults to 2 and offers 1 to 10", async () => {
  render(<TrackingSection value={null} onChange={() => {}} disabled={false} />);
  expect(screen.getByText("Suivi")).toBeTruthy();
  const limit = screen.getByRole("combobox", { name: "Limite de fonctionnalités ouvertes" });
  expect(limit.textContent).toBe("2");
  limit.focus();
  await userEvent.setup().keyboard("{Enter}");
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(
    Array.from({ length: 10 }, (_, i) => String(i + 1)),
  );
});

test("choosing a limit reports it, and the default goes back to null", async () => {
  const changes: (TrackingSettings | null)[] = [];
  const user = userEvent.setup();
  const view = render(<TrackingSection value={null} onChange={(v) => changes.push(v)} disabled={false} />);
  await pick(user, "3");
  view.rerender(
    <TrackingSection value={{ openLimit: 3 }} onChange={(v) => changes.push(v)} disabled={false} />,
  );
  await pick(user, "2");
  expect(changes).toEqual([{ openLimit: 3 }, null]);
});

test("saving the project dialog sends updateProject with the tracking settings", async () => {
  const first = projectsFixture[0];
  if (!first) throw new Error("expected a project");
  const project: ProjectSummary = { ...first, folder: null, tracking: null };
  const user = userEvent.setup();
  render(<EditProjectDialog project={project} onClose={() => {}} />);
  await pick(user, "4");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === "updateProject")).toEqual({
      method: "updateProject",
      projectId: project.id,
      patch: { tracking: { openLimit: 4 } },
    }),
  );
});
