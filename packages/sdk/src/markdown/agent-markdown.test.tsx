import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgentMarkdownView, type MarkdownLabels } from "./agent-markdown";
import { PLAN_TABLE } from "./fixtures";

afterEach(cleanup);

const labels: MarkdownLabels = {
  table: "Tableau",
  expand: "Agrandir",
  expandTable: "Agrandir le tableau",
  size: (rows, columns) => `${rows} lignes · ${columns} colonnes`,
  copy: "Copier en Markdown",
  copied: "Copié",
  copyFailed: "Copie impossible",
};

const view = (text: string, onTicket?: (key: string) => void) =>
  render(<AgentMarkdownView text={text} labels={labels} onTicket={onTicket} />);

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

test("the agent plan renders as a real table with a header", () => {
  view(PLAN_TABLE);
  const table = screen.getByRole("table");
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent);
  expect(headers).toEqual(["Ordre", "Ticket", "Ce que ça donne", "Attend"]);
  expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
  expect(screen.getByText("Voici l'ordre proposé :").tagName).toBe("P");
});

test("the table scrolls in its own frame and long cells wrap", () => {
  const long = "mot ".repeat(80).trim();
  view(`| a | b |\n|---|---|\n| ${long} | 1 |`);
  const frame = screen.getByRole("region", { name: "Tableau" });
  expect(frame.className).toContain("overflow-x-auto");
  const cell = screen.getByText(long);
  expect(cell.className).toContain("max-w-80");
  expect(cell.className).toContain("whitespace-normal");
});

test("ticket keys in cells open the ticket", () => {
  const opened: string[] = [];
  view(PLAN_TABLE, (key) => opened.push(key));
  fireEvent.click(screen.getByRole("button", { name: "SILO-14" }));
  expect(opened).toEqual(["SILO-14"]);
});

test("agent HTML and javascript links never become live nodes", () => {
  const { container } = view(
    '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[clic](javascript:alert(1)) [doc](https://kibo.dev)',
  );
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("<script>alert(1)</script>");
  const links = Array.from(container.querySelectorAll("a"));
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["https://kibo.dev"]);
  expect(links[0]?.getAttribute("target")).toBe("_blank");
  expect(links[0]?.getAttribute("rel")).toBe("noreferrer noopener");
});

test("Agrandir opens a titled sheet with the table, Escape closes it and gives focus back", async () => {
  view(PLAN_TABLE);
  const expand = screen.getByRole("button", { name: "Agrandir le tableau" });
  act(() => expand.focus());
  fireEvent.click(expand);
  const sheet = await screen.findByRole("dialog", { name: "Tableau" });
  expect(sheet.textContent).toContain("2 lignes · 4 colonnes");
  expect(sheet.querySelector("table tbody")?.children).toHaveLength(2);
  fireEvent.keyDown(sheet, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(expand);
});

test("Copier en Markdown copies the table source", async () => {
  const written: string[] = [];
  stubClipboard(async (text) => void written.push(text));
  view(PLAN_TABLE);
  fireEvent.click(screen.getByRole("button", { name: "Agrandir le tableau" }));
  fireEvent.click(await screen.findByRole("button", { name: "Copier en Markdown" }));
  await screen.findByText("Copié");
  expect(written).toEqual([PLAN_TABLE.split("\n").slice(2).join("\n")]);
});

test("a refused copy says so", async () => {
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (e: unknown) => void errors.push(e);
  stubClipboard(() => Promise.reject(new Error("denied")));
  try {
    view(PLAN_TABLE);
    fireEvent.click(screen.getByRole("button", { name: "Agrandir le tableau" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copier en Markdown" }));
    await screen.findByText("Copie impossible");
    expect(errors).toHaveLength(1);
  } finally {
    console.error = original;
  }
});

test("paragraph line breaks, lists and code keep their shape", () => {
  const { container } = view("Écrit.\nTout passe.\n\n- un\n- deux\n\n```\nbun test\n```");
  expect(container.querySelector("p br")).not.toBeNull();
  expect(container.querySelectorAll("ul li")).toHaveLength(2);
  expect(container.querySelector("pre code")?.textContent).toBe("bun test\n");
});
