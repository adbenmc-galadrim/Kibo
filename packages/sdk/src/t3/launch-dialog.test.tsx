import { afterEach, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { onToast } from "../toast-bus";
import { LaunchDialog } from "./LaunchDialog";
import { ACTIVE_THREAD, mockWithT3 } from "./t3-test-kit";

afterEach(cleanup);

const AVAILABLE = { available: true, bin: "t3" } as const;
const COMMAND = 't3 thread start ~/Documents/silo "/full-delivery SILO-45"';

const open = (t3: Parameters<typeof mockWithT3>[0], onClose: () => void = () => undefined) => {
  const { wrap, mock } = mockWithT3(t3);
  render(wrap(<LaunchDialog projectId="p1" ticketKey="SILO-45" onClose={onClose} />));
  return mock;
};

test("opening calls t3.preview and shows the exact command, the folder and Modèle · par défaut", async () => {
  open({ status: AVAILABLE, folder: "~/Documents/silo" });
  expect(await screen.findByText(COMMAND)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Lancer SILO-45 dans T3" })).toBeTruthy();
  expect(
    screen.getByText("Kibo ouvre une session T3 Code qui livre l'étape avec /full-delivery."),
  ).toBeTruthy();
  expect(screen.getByText("Projet T3").nextElementSibling?.textContent).toBe("~/Documents/silo");
  expect(screen.getByText("Modèle").nextElementSibling?.textContent).toBe("par défaut");
});

test("shows the amber warning when the ticket is not startable and still allows Lancer", async () => {
  open({ status: AVAILABLE, warning: "attend SILO-33" });
  const warning = await screen.findByText("attend SILO-33");
  expect(warning.className).toContain("--tracking-amber");
  expect((screen.getByRole("button", { name: "Lancer" }) as HTMLButtonElement).disabled).toBe(false);
});

test("Lancer calls t3.launch once and closes", async () => {
  const launches: string[] = [];
  let closed = 0;
  open({ status: AVAILABLE, launches }, () => {
    closed += 1;
  });
  await screen.findByText(/thread start/);
  await userEvent.dblClick(screen.getByRole("button", { name: "Lancer" }));
  await waitFor(() => expect(closed).toBe(1));
  expect(launches).toEqual(["SILO-45"]);
});

test("T3_FAILED shows the toast and keeps the dialog", async () => {
  const toasts: string[] = [];
  const off = onToast((message) => toasts.push(message));
  let closed = 0;
  open({ status: AVAILABLE, launchError: new KiboError("T3_FAILED", "server stopped") }, () => {
    closed += 1;
  });
  await screen.findByText(/thread start/);
  await userEvent.click(screen.getByRole("button", { name: "Lancer" }));
  await waitFor(() => expect(toasts).toEqual(["T3 n'a pas pu lancer SILO-45 · server stopped"]));
  off();
  expect(closed).toBe(0);
  expect(screen.getByRole("heading", { name: "Lancer SILO-45 dans T3" })).toBeTruthy();
});

test("T3_THREAD_ACTIVE switches to Ouvrir dans T3", async () => {
  open({
    status: AVAILABLE,
    launchError: new KiboError("T3_THREAD_ACTIVE", "already running"),
    thread: ACTIVE_THREAD,
  });
  await screen.findByText(/thread start/);
  await userEvent.click(screen.getByRole("button", { name: "Lancer" }));
  const link = await screen.findByRole("link", { name: "Ouvrir dans T3" });
  expect(link.getAttribute("href")).toBe(ACTIVE_THREAD.link);
  expect(screen.queryByRole("button", { name: "Lancer" })).toBeNull();
});

test("a preview that fails is shown in the dialog", async () => {
  open({ status: AVAILABLE, previewError: new KiboError("PROJECT_FOLDER_MISSING", "no folder") });
  expect((await screen.findByRole("alert")).textContent).toContain("no folder");
  expect((screen.getByRole("button", { name: "Lancer" }) as HTMLButtonElement).disabled).toBe(true);
});
