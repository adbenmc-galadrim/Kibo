import { expect, test } from "bun:test";
import type { AppSettings, AppSettingsPatch } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppSettingsStore } from "../state/app-settings";
import { AppSettingsProvider } from "../state/use-app-settings";
import { ExecutionCard } from "./ExecutionCard";

function storeWith(initial: AppSettings, fail = false) {
  let stored = initial;
  const writes: AppSettingsPatch[] = [];
  const store = createAppSettingsStore({
    getAppSettings: () => Promise.resolve(stored),
    setAppSettings: (patch) => {
      writes.push(patch);
      if (fail) return Promise.reject(new Error("refused"));
      stored = { ...stored, ...patch };
      return Promise.resolve(stored);
    },
    subscribeConfig: () => () => undefined,
  });
  return { store, writes };
}

const card = (store: ReturnType<typeof storeWith>["store"]) =>
  render(
    <AppSettingsProvider store={store}>
      <ExecutionCard />
    </AppSettingsProvider>,
  );

test("the card explains the default and its switch is off while execution is hidden", async () => {
  const { store } = storeWith({ agentExecution: "hidden" });
  card(store);
  expect(screen.getByText("Exécution des agents dans Kibo")).toBeTruthy();
  expect(
    screen.getByText(
      "Le développement se fait dans T3 Code avec full-delivery. Activer pour lancer et suivre des agents depuis Kibo.",
    ),
  ).toBeTruthy();
  const toggle = screen.getByRole("switch", { name: "Exécution des agents dans Kibo" });
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
});

test("turning the switch on sends setAppSettings and reflects the answer", async () => {
  const { store, writes } = storeWith({ agentExecution: "hidden" });
  card(store);
  const toggle = screen.getByRole("switch", { name: "Exécution des agents dans Kibo" });
  await userEvent.setup().click(toggle);
  expect(writes).toEqual([{ agentExecution: "shown" }]);
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
});

test("turning it off hides execution again", async () => {
  const { store, writes } = storeWith({ agentExecution: "shown" });
  card(store);
  const toggle = screen.getByRole("switch", { name: "Exécution des agents dans Kibo" });
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
  await userEvent.setup().click(toggle);
  expect(writes).toEqual([{ agentExecution: "hidden" }]);
});

test("a refused change is reported and the switch stays as it was", async () => {
  const { store } = storeWith({ agentExecution: "hidden" }, true);
  card(store);
  const toggle = screen.getByRole("switch", { name: "Exécution des agents dans Kibo" });
  await userEvent.setup().click(toggle);
  expect((await screen.findByRole("alert")).textContent).toContain("Impossible de changer ce réglage.");
  expect(toggle.getAttribute("aria-checked")).toBe("false");
});
