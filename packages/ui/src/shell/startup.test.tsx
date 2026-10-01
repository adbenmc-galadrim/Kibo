import { expect, mock, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { DaemonUnreachable } from "./DaemonUnreachable";
import { RootBoundary } from "./RootBoundary";
import { LoadingScreen } from "./Startup";

const network = new TypeError("Failed to fetch");

test("the loading screen stays blank before its delay, then names Kibo", async () => {
  render(<LoadingScreen delayMs={30} />);
  expect(screen.queryByText("Chargement de Kibo…")).toBeNull();
  expect(await screen.findByText("Chargement de Kibo…")).toBeTruthy();
});

test("in the app, the unreachable screen says to relaunch Kibo", () => {
  render(<DaemonUnreachable error={network} inApp nextRetryInMs={3000} onRetry={() => {}} />);
  expect(screen.getByRole("heading", { name: "Kibo ne répond pas" })).toBeTruthy();
  expect(screen.getByText("Kibo n'est pas lancé, ou il ne répond pas à cette adresse.")).toBeTruthy();
  expect(screen.getByText("Relance Kibo.")).toBeTruthy();
  expect(screen.queryByText(/Vérifie que Kibo tourne/)).toBeNull();
  expect(screen.getByText("Nouvelle tentative dans 3 s…")).toBeTruthy();
});

test("in a browser, it says to check that Kibo runs, and Réessayer calls onRetry", () => {
  const onRetry = mock(() => {});
  render(<DaemonUnreachable error={network} inApp={false} nextRetryInMs={0} onRetry={onRetry} />);
  expect(screen.getByText("Vérifie que Kibo tourne sur l'ordinateur, puis réessaie.")).toBeTruthy();
  expect(screen.queryByText("Relance Kibo.")).toBeNull();
  expect(screen.queryByText(/Nouvelle tentative/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("a daemon error is explained instead of the network advice", () => {
  render(
    <DaemonUnreachable
      error={new KiboError("MIGRATION_FAILED", "schema v3")}
      inApp={false}
      nextRetryInMs={3000}
      onRetry={() => {}}
    />,
  );
  expect(screen.getByRole("heading", { name: "Kibo n'a pas pu s'ouvrir" })).toBeTruthy();
  expect(screen.getByText("La migration de la configuration a échoué. (schema v3)")).toBeTruthy();
  expect(screen.queryByText(/Vérifie que Kibo tourne/)).toBeNull();
  expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
});

function Broken(): never {
  throw new Error("render failed");
}

test("the root boundary catches a render error and offers to reload", () => {
  const reload = mock(() => {});
  const log = console.error;
  console.error = () => {};
  try {
    render(
      <RootBoundary onReload={reload}>
        <Broken />
      </RootBoundary>,
    );
  } finally {
    console.error = log;
  }
  expect(screen.getByRole("heading", { name: "Quelque chose s'est mal passé" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Recharger" }));
  expect(reload).toHaveBeenCalledTimes(1);
});
