import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LaunchInT3Button } from "./LaunchInT3Button";
import { ACTIVE_THREAD, mockWithT3 } from "./t3-test-kit";

afterEach(cleanup);

const AVAILABLE = { available: true, bin: "t3" } as const;
const PROPS = { projectId: "p1", ticketKey: "SILO-45", done: false, thread: null };

test("renders Lancer dans T3 for a startable open ticket", async () => {
  const { wrap } = mockWithT3({ status: AVAILABLE });
  render(wrap(<LaunchInT3Button {...PROPS} />));
  const button = await screen.findByRole("button", { name: "Lancer dans T3" });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
});

test("renders nothing for a done ticket", () => {
  const { wrap } = mockWithT3({ status: AVAILABLE });
  const { container } = render(wrap(<LaunchInT3Button {...PROPS} done />));
  expect(container.textContent).toBe("");
});

test("is disabled with the missing tooltip when T3 is missing and with the server tooltip when the server is down", async () => {
  const missing = mockWithT3({ status: { available: false, reason: "missing", bin: "t3" } });
  const first = render(missing.wrap(<LaunchInT3Button {...PROPS} />));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Lancer dans T3" }).parentElement?.title).toBe(
      "T3 Code n'est pas installé",
    ),
  );
  expect((screen.getByRole("button", { name: "Lancer dans T3" }) as HTMLButtonElement).disabled).toBe(true);
  first.unmount();
  const down = mockWithT3({ status: { available: false, reason: "server-down", bin: "t3" } });
  render(down.wrap(<LaunchInT3Button {...PROPS} />));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Lancer dans T3" }).parentElement?.title).toBe(
      "T3 Code n'est pas lancé · ouvre-le puis réessaie",
    ),
  );
});

test("is disabled with Relie le dossier du projet when the project has no folder, and a click opens the settings", async () => {
  const { mock, wrap } = mockWithT3({ status: AVAILABLE });
  render(wrap(<LaunchInT3Button {...PROPS} folderMissing />));
  const button = screen.getByRole("button", { name: "Lancer dans T3" });
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(button.title).toBe("Relie le dossier du projet");
  await userEvent.click(button);
  expect(mock.projectEdits).toEqual([{ field: "folder" }]);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("with an active thread renders ThreadBadge and Ouvrir dans T3 instead", () => {
  const { wrap } = mockWithT3({ status: AVAILABLE });
  render(wrap(<LaunchInT3Button {...PROPS} thread={ACTIVE_THREAD} />));
  expect(screen.queryByRole("button", { name: "Lancer dans T3" })).toBeNull();
  expect(screen.getByRole("link", { name: "Ouvrir dans T3" }).getAttribute("href")).toBe(ACTIVE_THREAD.link);
});

test("a finished thread gives the button back", async () => {
  const { wrap } = mockWithT3({ status: AVAILABLE });
  render(wrap(<LaunchInT3Button {...PROPS} thread={{ ...ACTIVE_THREAD, status: "done" }} />));
  expect(await screen.findByRole("button", { name: "Lancer dans T3" })).toBeTruthy();
});

test("the status is read once for several buttons", async () => {
  let reads = 0;
  const { wrap } = mockWithT3({
    get status() {
      reads += 1;
      return AVAILABLE;
    },
  });
  render(
    wrap(
      <>
        <LaunchInT3Button {...PROPS} />
        <LaunchInT3Button {...PROPS} ticketKey="SILO-46" />
      </>,
    ),
  );
  await waitFor(() => expect(reads).toBe(1));
});
