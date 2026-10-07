import { describe, expect, test } from "bun:test";
import { INBOX_ID, type ProjectSnapshot } from "@kibo/schema";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { configFixture } from "../agents/fixtures";
import { withInbox } from "../lib/inbox";
import { fac, kib, mineSnapshots, mineTicket, por } from "./fixtures";
import { MyTicketsPage } from "./MyTicketsPage";

type Handlers = {
  onOpenTicket?(p: string, t: string): void;
  onAssign?(p: string, t: string): void;
  onFile?(t: string): void;
};

function renderPage(h: Handlers = {}) {
  return render(
    <MyTicketsPage
      viewer="adam"
      projects={[kib, por, fac]}
      snapshots={mineSnapshots}
      config={configFixture()}
      onOpenTicket={h.onOpenTicket ?? (() => {})}
      onAssign={h.onAssign ?? (() => {})}
      onFile={h.onFile ?? (() => {})}
    />,
  );
}

const rowKeys = (region: HTMLElement) =>
  within(region)
    .getAllByRole("button", { name: /^[A-Z]+-\d+/ })
    .map((b) => b.getAttribute("aria-label")?.split(" ")[0]);

describe("my tickets page", () => {
  test("groups my tickets by project with the mockup summary", () => {
    renderPage();
    expect(screen.getByText("9 tickets · 3 projets")).toBeTruthy();
    expect(rowKeys(screen.getByRole("region", { name: "Kibo" }))).toEqual([
      "KIB-21",
      "KIB-15",
      "KIB-9",
      "KIB-7",
      "KIB-11",
      "KIB-22",
    ]);
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  test("opening a row and assigning report the project", () => {
    const opened: string[][] = [];
    const assigned: string[][] = [];
    renderPage({ onOpenTicket: (p, t) => opened.push([p, t]), onAssign: (p, t) => assigned.push([p, t]) });
    const kibo = screen.getByRole("region", { name: "Kibo" });
    fireEvent.click(within(kibo).getByRole("button", { name: /^KIB-21/ }));
    fireEvent.click(within(kibo).getAllByRole("button", { name: "Assigner" })[0] as HTMLElement);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.[0]).toBe("kib");
    expect(assigned).toEqual([["kib", opened[0]?.[1] ?? ""]]);
    const facturation = screen.getByRole("region", { name: "API Facturation" });
    expect(
      within(facturation).getAllByRole("button", { name: "Assigner" })[0]?.hasAttribute("disabled"),
    ).toBe(true);
  });

  test("my agents tab, and only two filters", () => {
    renderPage();
    expect(screen.queryByRole("radio", { name: "Créés par moi" })).toBeNull();
    const filters = screen.getByRole("radiogroup", { name: "Filtre des tickets" });
    expect(within(filters).getAllByRole("radio")).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: "Mes agents" }));
    expect(screen.getByText("1 ticket · 1 projet")).toBeTruthy();
    const kibo = screen.getByRole("region", { name: "Kibo" });
    expect(rowKeys(kibo)).toEqual(["KIB-12"]);
    expect(within(kibo).getByText("opus-dev")).toBeTruthy();
    expect(within(kibo).queryByRole("button", { name: "Assigner" })).toBeNull();
  });

  test("my agents falls back on the assignee ref without a known profile", () => {
    render(
      <MyTicketsPage
        viewer="adam"
        projects={[kib]}
        snapshots={mineSnapshots}
        config={null}
        onOpenTicket={() => {}}
        onAssign={() => {}}
        onFile={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Mes agents" }));
    expect(within(screen.getByRole("region", { name: "Kibo" })).getByText("opus")).toBeTruthy();
  });

  test("an empty tab says so", () => {
    render(
      <MyTicketsPage
        viewer="eve"
        projects={[kib, por, fac]}
        snapshots={mineSnapshots}
        config={null}
        onOpenTicket={() => {}}
        onAssign={() => {}}
        onFile={() => {}}
      />,
    );
    expect(screen.getByText("Aucun ticket ouvert ne t'est assigné.")).toBeTruthy();
    expect(screen.getByText("0 ticket · 0 projet")).toBeTruthy();
  });

  test("inbox tickets assigned to me form a « Boîte de réception » group, filed rather than run by an agent", () => {
    const base = mineSnapshots.get(kib.id);
    if (!base) throw new Error("fixture");
    const inbox: ProjectSnapshot = {
      ...base,
      meta: { id: INBOX_ID, key: "INB", name: "Inbox", folder: null, color: "#64748B", worktree: null },
      tickets: [mineTicket("INB-2", "todo", { kind: "human", ref: "adam" })],
    };
    const snapshots = new Map(mineSnapshots).set(INBOX_ID, inbox);
    const assigned: string[] = [];
    const filed: string[] = [];
    render(
      <MyTicketsPage
        viewer="adam"
        projects={withInbox([kib], snapshots)}
        snapshots={snapshots}
        config={configFixture()}
        onOpenTicket={() => {}}
        onAssign={(p) => assigned.push(p)}
        onFile={(t) => filed.push(t)}
      />,
    );
    expect(screen.getAllByRole("region")).toHaveLength(2);
    const group = screen.getByRole("region", { name: "Boîte de réception" });
    expect(rowKeys(group)).toEqual(["INB-2"]);
    expect(within(group).queryByRole("button", { name: "Assigner" })).toBeNull();
    const file = within(group).getByRole("button", { name: "Rattacher…" });
    expect(file.hasAttribute("disabled")).toBe(false);
    expect(file.getAttribute("title")).toBe(
      "Rattache d'abord ce ticket à un projet pour le confier à un agent.",
    );
    fireEvent.click(file);
    expect(filed).toEqual([inbox.tickets[0]?.id ?? ""]);
    expect(assigned).toEqual([]);
  });
});
