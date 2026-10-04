import { expect, test } from "bun:test";
import { type Diagnostics, KiboError } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportDialog } from "./ReportDialog";
import { ISSUE_URL, reportText } from "./report-text";

const app: Diagnostics["app"] = {
  version: "1.5.0",
  platform: "linux",
  arch: "x64",
  home: "~/.kibo",
  daemonPid: 7,
  uptimeMs: 0,
};
const DIAG: Diagnostics = {
  app,
  environment: {
    daemon: { address: "127.0.0.1:4317", home: "~/.kibo" },
    ai: {
      available: true,
      reason: null,
      version: "2.1.0",
      loggedIn: true,
      profiles: { assistant: true, generateur: true },
    },
    git: "2.46",
    gh: null,
    capacity: { cores: 4, ramGb: 8, hostSlots: 2 },
    github: { connected: false },
    app,
  },
  counts: { projects: 1, tickets: 2, components: 3, instances: 4, profiles: 2 },
  integrations: [],
  log: ["[kibo-daemon] boom at ~/.kibo/x"],
};

const findReport = async (scope: Pick<typeof screen, "findByRole"> = screen) => {
  const region = await scope.findByRole("region", { name: "Rapport" });
  const pre = region.querySelector("pre");
  if (!pre) throw new Error("report is not in a pre");
  return pre;
};

const stubClipboard = () => {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
  return written;
};

test("the whole report is shown before any action, and Copier writes exactly that text", async () => {
  const user = userEvent.setup();
  const written = stubClipboard();
  render(<ReportDialog open shell="browser" load={async () => DIAG} onClose={() => {}} />);
  const dialog = await screen.findByRole("dialog", { name: "Signaler un problème" });
  const d = within(dialog);
  const pre = await findReport(d);
  expect(pre.textContent).toBe(reportText(DIAG, "browser"));
  await user.click(d.getByRole("button", { name: "Copier" }));
  expect(written).toEqual([reportText(DIAG, "browser")]);
  expect(await d.findByRole("button", { name: "Copié" })).toBeTruthy();
});

test("the GitHub link opens the issue template and never carries the report", async () => {
  render(<ReportDialog open shell="browser" load={async () => DIAG} onClose={() => {}} />);
  const link = await screen.findByRole("link", { name: "Ouvrir une issue GitHub" });
  const href = link.getAttribute("href") ?? "";
  expect(href).toBe(ISSUE_URL);
  expect(href).not.toContain("Journal");
  expect(href).not.toContain("kibo-daemon");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noreferrer");
});

test("unchecking Inclure le journal removes the journal from the text and the copy", async () => {
  const user = userEvent.setup();
  const written = stubClipboard();
  render(<ReportDialog open shell="browser" load={async () => DIAG} onClose={() => {}} />);
  const pre = await findReport();
  await user.click(screen.getByRole("checkbox", { name: "Inclure le journal" }));
  expect(pre.textContent).not.toContain("Journal");
  await user.click(screen.getByRole("button", { name: "Copier" }));
  expect(written[0]).toBe(reportText(DIAG, "browser", { log: false }));
});

test("a failed diagnostics call shows the error and keeps Copier disabled", async () => {
  render(
    <ReportDialog
      open
      shell="browser"
      load={async () => {
        throw new KiboError("FORBIDDEN", "this action is only allowed from this machine");
      }}
      onClose={() => {}}
    />,
  );
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(
    "Le rapport n'a pas pu être préparé : il ne se prépare que sur l'ordinateur où tourne Kibo.",
  );
  expect(screen.getByRole("button", { name: "Copier" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("region", { name: "Rapport" })).toBeNull();
});
