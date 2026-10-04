import { expect, spyOn, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AutostartPort } from "../desktop/autostart";
import { ApplicationCard } from "./ApplicationCard";

function fakePort(initial: boolean, failEnable = false) {
  const calls: string[] = [];
  let enabled = initial;
  const port: AutostartPort = {
    isEnabled: async () => {
      calls.push("is");
      return enabled;
    },
    enable: async () => {
      calls.push("on");
      if (failEnable) throw new Error("launch agent refused");
      enabled = true;
    },
    disable: async () => {
      calls.push("off");
      enabled = false;
    },
  };
  return { port, calls };
}

test("the switch reflects the system state and turning it on enables the launch at login", async () => {
  const { port, calls } = fakePort(false);
  render(<ApplicationCard port={port} desktop />);
  expect(screen.getByText("Application")).toBeTruthy();
  const toggle = await screen.findByRole("switch", { name: "Ouvrir Kibo à l'ouverture de session" });
  expect(await screen.findByText("Désactivé")).toBeTruthy();
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  expect(screen.getByText(/Garde Kibo dans le dossier Applications/)).toBeTruthy();
  await userEvent.setup().click(toggle);
  expect(await screen.findByText("Activé")).toBeTruthy();
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(calls).toEqual(["is", "on"]);
});

test("turning it off disables the launch at login", async () => {
  const { port, calls } = fakePort(true);
  render(<ApplicationCard port={port} desktop />);
  expect(await screen.findByText("Activé")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("switch"));
  expect(await screen.findByText("Désactivé")).toBeTruthy();
  expect(calls).toEqual(["is", "off"]);
});

test("a refused change shows the error and keeps the previous state", async () => {
  const error = spyOn(console, "error").mockImplementation(() => {});
  const { port } = fakePort(false, true);
  render(<ApplicationCard port={port} desktop />);
  const toggle = await screen.findByRole("switch");
  await screen.findByText("Désactivé");
  await userEvent.setup().click(toggle);
  expect(await screen.findByText("Le réglage n'a pas pu être modifié.")).toBeTruthy();
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  expect(screen.getByText("Désactivé")).toBeTruthy();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

test("outside the desktop application the card says where the setting lives, without a switch", () => {
  const { port, calls } = fakePort(false);
  render(<ApplicationCard port={port} desktop={false} />);
  expect(screen.getByText("Ce réglage vit dans l'application de bureau.")).toBeTruthy();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(calls).toEqual([]);
});
