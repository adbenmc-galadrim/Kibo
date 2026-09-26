import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { configFixture } from "../agents/fixtures";
import { fac, kib, mineSnapshots, por } from "./fixtures";
import { MyTicketsPage } from "./MyTicketsPage";

type Handlers = { onOpenTicket?(p: string, t: string): void; onAssign?(p: string, t: string): void };

function renderPage(h: Handlers = {}) {
  return render(
    <MyTicketsPage
      viewer="adam"
      projects={[kib, por, fac]}
      snapshots={mineSnapshots}
      config={configFixture()}
      onOpenTicket={h.onOpenTicket ?? (() => {})}
      onAssign={h.onAssign ?? (() => {})}
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

  test("my agents tab and the disabled created tab", () => {
    renderPage();
    expect(screen.getByRole("radio", { name: "Créés par moi" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Mes agents" }));
    expect(screen.getByText("1 ticket · 1 projet")).toBeTruthy();
    const kibo = screen.getByRole("region", { name: "Kibo" });
    expect(rowKeys(kibo)).toEqual(["KIB-12"]);
    expect(within(kibo).getByText("opus-dev")).toBeTruthy();
    expect(within(kibo).queryByRole("button", { name: "Assigner" })).toBeNull();
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
      />,
    );
    expect(screen.getByText("Aucun ticket ouvert ne t'est assigné.")).toBeTruthy();
    expect(screen.getByText("0 ticket · 0 projet")).toBeTruthy();
  });
});
