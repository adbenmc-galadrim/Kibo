import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_RECIPIENTS,
  DEFAULT_WORKFLOW,
  KiboError,
  type ProjectSnapshot,
  type Question,
  type RpcRequest,
} from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const TICKET = "11111111-1111-4111-8111-111111111111";

const question = (n: number, recipient: string): Question => ({
  kind: "question",
  images: [],
  id: `2222222${n}-2222-4222-8222-222222222222`,
  ticketId: TICKET,
  runId: null,
  title: `Question ${n} ?`,
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-1" },
  createdAt: 1,
  importRef: null,
  answer: null,
  recipient,
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
});

const base: ProjectSnapshot = {
  meta: {
    id: "kibo",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [question(1, "client"), question(2, "client"), question(3, "me")],
  questionRecipients: [...DEFAULT_RECIPIENTS, { id: "design", name: "Design" }],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sprints: [],
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

const commands: RpcRequest[] = [];
let snapshot: ProjectSnapshot = base;
let refuse: KiboError | null = null;
const listeners = new Set<(projectId: string | null) => void>();

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        if (req.method === "getProject") return snapshot;
        if (req.method !== "command") throw new Error(`unexpected ${req.method}`);
        commands.push(req);
        if (refuse) throw refuse;
        for (const l of listeners) l("kibo");
        return null;
      },
      subscribe: (listener: (projectId: string | null) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  }),
);
const { RecipientsFields } = await import("./RecipientsFields");

beforeEach(() => {
  commands.length = 0;
  snapshot = base;
  refuse = null;
});

const sent = () => commands.map((c) => (c.method === "command" ? c.command : null));

test("lists the recipients with their open questions; « me » cannot be removed", async () => {
  render(<RecipientsFields projectId="kibo" />);
  const list = await screen.findByRole("list", { name: "Destinataires des questions" });
  const rows = within(list).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual([
    expect.stringContaining("Moi (technique)"),
    expect.stringContaining("Produit"),
    expect.stringContaining("Client"),
    expect.stringContaining("Design"),
  ]);
  expect(within(rows[0] as HTMLElement).getByText("1 question ouverte")).toBeTruthy();
  expect(within(rows[2] as HTMLElement).getByText("2 questions ouvertes")).toBeTruthy();
  expect(within(rows[3] as HTMLElement).getByText("aucune question ouverte")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Supprimer Moi (technique)" })).toBeNull();
  expect(screen.getByRole("button", { name: "Supprimer Design" })).toBeTruthy();
});

test("renames a recipient in place", async () => {
  render(<RecipientsFields projectId="kibo" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Renommer Produit" }));
  const field = screen.getByRole("textbox", { name: "Nouveau nom de Produit" });
  await user.clear(field);
  await user.type(field, "Produit et design{Enter}");
  await waitFor(() =>
    expect(sent()).toEqual([
      { method: "renameQuestionRecipient", recipientId: "product", name: "Produit et design" },
    ]),
  );
  expect(screen.queryByRole("textbox", { name: "Nouveau nom de Produit" })).toBeNull();
});

test("adds a recipient", async () => {
  render(<RecipientsFields projectId="kibo" />);
  const user = userEvent.setup();
  const add = await screen.findByRole("button", { name: "Ajouter" });
  expect(add.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByRole("textbox", { name: "Nouveau destinataire" }), "  Juridique ");
  await user.click(add);
  await waitFor(() => expect(sent()).toEqual([{ method: "addQuestionRecipient", name: "Juridique" }]));
  expect((screen.getByRole("textbox", { name: "Nouveau destinataire" }) as HTMLInputElement).value).toBe("");
});

test("removes a recipient, and says how many open questions use a refused one", async () => {
  render(<RecipientsFields projectId="kibo" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Supprimer Design" }));
  await waitFor(() => expect(sent()).toEqual([{ method: "removeQuestionRecipient", recipientId: "design" }]));
  refuse = new KiboError("CONFLICT", "recipient in use");
  await user.click(screen.getByRole("button", { name: "Supprimer Client" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Utilisé par 2 questions ouvertes");
});

test("a recipient over the quota is explained", async () => {
  render(<RecipientsFields projectId="kibo" />);
  const user = userEvent.setup();
  refuse = new KiboError("QUOTA_EXCEEDED", "too many recipients");
  await user.type(await screen.findByRole("textbox", { name: "Nouveau destinataire" }), "Juridique");
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  expect((await screen.findByRole("alert")).textContent).toBe("20 destinataires au plus.");
});

test("a read-only project shows no recipient section", async () => {
  snapshot = { ...base, sync: { ...base.sync, access: "read-only" } };
  const { container } = render(<RecipientsFields projectId="kibo" />);
  await act(() => new Promise((r) => setTimeout(r, 20)));
  expect(container.textContent).toBe("");
});
