import { expect, test } from "bun:test";
import type { AppInfo } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AboutDialog } from "./AboutDialog";

const info: AppInfo = {
  version: "1.5.0",
  platform: "darwin",
  arch: "arm64",
  home: "~/.kibo",
  daemonPid: 42,
  uptimeMs: 65_000,
};

test("the about dialog shows the brand, version, system, daemon and the outside links", async () => {
  render(
    <AboutDialog open info={info} port={4317} shell="tauri" onClose={() => {}} onReleaseNotes={() => {}} />,
  );
  const dialog = await screen.findByRole("dialog", { name: "À propos de Kibo" });
  const d = within(dialog);
  expect(d.getByRole("img", { name: "Kibo" })).toBeTruthy();
  expect(d.getByText("Kibo 1.5.0")).toBeTruthy();
  expect(d.getByText("macOS · Apple Silicon · application de bureau")).toBeTruthy();
  expect(d.getByText("Démon : PID 42 · port 4317 · ~/.kibo")).toBeTruthy();
  const links = d
    .getAllByRole("link")
    .map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]);
  expect(links).toEqual([
    ["Code source", "https://github.com/adbenmc-galadrim/Kibo", "_blank", "noreferrer"],
    ["Licence MIT", "https://github.com/adbenmc-galadrim/Kibo/blob/main/LICENSE", "_blank", "noreferrer"],
  ]);
});

test("release notes open the local changelog first", async () => {
  let opened = 0;
  render(
    <AboutDialog
      open
      info={info}
      port={4317}
      shell="browser"
      onClose={() => {}}
      onReleaseNotes={() => opened++}
    />,
  );
  await userEvent.setup().click(await screen.findByRole("button", { name: "Notes de version" }));
  expect(opened).toBe(1);
});

test("copy writes the plain text summary to the clipboard and confirms", async () => {
  const user = userEvent.setup();
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
  render(
    <AboutDialog open info={info} port={4317} shell="browser" onClose={() => {}} onReleaseNotes={() => {}} />,
  );
  await user.click(await screen.findByRole("button", { name: "Copier les informations" }));
  expect(await screen.findByRole("button", { name: "Copié" })).toBeTruthy();
  expect(written).toEqual([
    "Kibo 1.5.0\nmacOS · Apple Silicon · navigateur\nDémon : PID 42 · port 4317 · ~/.kibo\nEn marche depuis 1 min",
  ]);
});

test("without the daemon information the dialog says so and copy is disabled", async () => {
  render(
    <AboutDialog open info={null} port={null} shell="browser" onClose={() => {}} onReleaseNotes={() => {}} />,
  );
  expect(await screen.findByText("Informations indisponibles : le démon ne répond pas.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copier les informations" }).hasAttribute("disabled")).toBe(true);
});

test("closing calls onClose", async () => {
  let closed = 0;
  render(
    <AboutDialog
      open
      info={info}
      port={1}
      shell="browser"
      onClose={() => closed++}
      onReleaseNotes={() => {}}
    />,
  );
  const dialog = await screen.findByRole("dialog");
  await userEvent.setup().click(within(dialog).getByRole("button", { name: "Fermer" }));
  expect(closed).toBe(1);
});
