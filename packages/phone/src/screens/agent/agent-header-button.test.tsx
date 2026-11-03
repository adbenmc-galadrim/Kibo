import { beforeEach, expect, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../../App";
import { phoneFixture } from "../../app-test-kit";
import { putBlob } from "../../fake-server-api";
import { sealJson } from "../../test-kit";
import { AgentHeaderButton } from "./AgentHeaderButton";
import { lotSeven, siloAgentProject, siloAgentSnapshot } from "./agent-test-kit";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/graph";
});

test("the header button shows the pending count from the blob", async () => {
  const fixture = await phoneFixture();
  const partlyDecided = lotSeven({ chosen: [1] });
  putBlob(fixture.api, await sealJson(fixture.keys, "silo", "project", siloAgentProject()));
  putBlob(fixture.api, await sealJson(fixture.keys, "silo", "agent", siloAgentSnapshot(partlyDecided)));
  render(<App runtime={fixture.runtime} />);
  const header = await screen.findByRole("banner");
  const button = await within(header).findByRole("button", { name: "Agent de projet · 2 en attente" });
  expect(button.textContent).toBe("2");
  fireEvent.click(button);
  expect(window.location.hash).toBe("#/p/silo/agent");
  expect(await screen.findByRole("heading", { name: "Agent de projet · Silo" })).toBeTruthy();
});

test("without a pending batch the button has no counter and keeps its name", () => {
  render(<AgentHeaderButton pending={0} onOpen={() => undefined} />);
  const button = screen.getByRole("button", { name: "Agent de projet" });
  expect(button.textContent).toBe("");
  expect(button.className).toContain("h-11");
});
