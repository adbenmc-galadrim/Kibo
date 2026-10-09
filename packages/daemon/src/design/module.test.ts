import { afterEach, beforeEach, expect, test } from "bun:test";
import { DesignFrame } from "@kibo/schema";
import { z } from "zod";
import {
  parseIntegrationFlags,
  type StartedIntegrations,
  startIntegrations,
} from "../integrations/bootstrap";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { createProjectSettings } from "../notes/settings";
import { LOCAL_STORYBOOK_KEY } from "../project-folder";
import { FAKE_FIGMA_IMAGE_HOST, type FakeFigma, startFakeFigma } from "../testing/fake-figma";
import { startFakeMcpHttp } from "../testing/fake-mcp";
import { type FakePenpot, penpotBoardUrl, startFakePenpot } from "../testing/fake-penpot";
import { startFakeStorybook } from "../testing/fake-storybook";

const NODE_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const FIGMA_TOKEN = "figd_TESTSECRET";
const PENPOT_TOKEN = "penpot-TESTSECRET";

const Statuses = z.array(z.object({ id: z.string(), state: z.string(), account: z.string().nullable() }));

let figma: FakeFigma;
let penpot: FakePenpot;
let host: FakeHost;
let rpc: StartedIntegrations;
let ticketId: string;

beforeEach(() => {
  figma = startFakeFigma({ token: FIGMA_TOKEN, handle: "adam" });
  figma.addFile("AbC123xyz", "Kibo");
  figma.addNode("AbC123xyz", "12:34", { name: "Tickets" });
  penpot = startFakePenpot({ token: PENPOT_TOKEN, fullname: "Adam" });
  penpot.addBoard(
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
    { name: "Fiche" },
  );
  host = createFakeHost();
  const flags = parseIntegrationFlags({
    "test-origins": `api.figma.com=${figma.url},${FAKE_FIGMA_IMAGE_HOST}=${figma.url}`,
    "memory-secrets": true,
  });
  rpc = startIntegrations(host, flags, createRedactor());
  ticketId = host.command(
    host.projectId,
    { method: "createTicket", title: "Arbre" },
    { origin: "user", instanceId: null },
  ).id;
});
afterEach(async () => {
  await rpc.stop();
  figma.stop();
  penpot.stop();
  host.close();
});

const stateOf = async (id: string) =>
  Statuses.parse(await rpc.handle({ method: "listIntegrations" })).find((s) => s.id === id);
const link = (url: string) =>
  rpc.handle({ method: "linkDesignFrame", projectId: host.projectId, ticketId, url });
const tokenOf = (url: string) => new URL(url).pathname.split("/")[2] ?? "";

test("figma by token: frames for the shell and for components, a link on the ticket", async () => {
  expect(await stateOf("figma")).toMatchObject({ state: "disconnected" });
  await expect(link(NODE_URL)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  await rpc.handle({ method: "connectFigma", auth: { mode: "token", token: FIGMA_TOKEN } });
  expect(await stateOf("figma")).toMatchObject({ state: "connected", account: "adam" });
  expect(await stateOf("penpot")).toMatchObject({ state: "disconnected" });
  expect(host.events).toContainEqual({ type: "integrations" });

  const frame = DesignFrame.parse(
    await rpc.handle({ method: "getDesignFrame", url: NODE_URL, refresh: false }),
  );
  expect(frame).toMatchObject({ provider: "figma", name: "Tickets", stale: false, reachable: true });
  expect(frame.url.startsWith(`${host.sandboxOrigin()}/d/`)).toBe(true);
  expect(await rpc.design.open(tokenOf(frame.url))).toMatchObject({ name: "frame.png", mime: "image/png" });

  const fromComponent = await rpc.hooks.design?.frame(
    { projectId: host.projectId, instanceId: "w1" },
    NODE_URL,
    false,
  );
  expect(fromComponent).toMatchObject({ id: frame.id, name: "Tickets" });
  expect(await rpc.design.open(tokenOf(fromComponent?.url ?? ""))).not.toBeNull();

  expect(await link(NODE_URL)).toMatchObject({ kind: "figma_node", nodeId: "12:34", name: "Tickets" });
  const refs = host.snapshot(host.projectId).tickets.find((t) => t.id === ticketId)?.externalRefs;
  expect(refs).toContainEqual(expect.objectContaining({ kind: "figma_node" }));
});

test("figma by mcp server renders with get_screenshot", async () => {
  const server = await startFakeMcpHttp();
  try {
    await rpc.handle({ method: "connectFigma", auth: { mode: "mcp", url: server.url } });
    expect(await stateOf("figma")).toMatchObject({ state: "connected", account: null });
    expect(await rpc.handle({ method: "getDesignFrame", url: NODE_URL, refresh: false })).toMatchObject({
      provider: "figma",
      mime: "image/png",
    });
    expect(await link(NODE_URL)).toMatchObject({ name: "Kibo › Tickets / Arbre" });
  } finally {
    await rpc.handle({ method: "disconnectIntegration", id: "figma" });
    await server.stop();
  }
});

test("penpot: connect, link a board, render it, disconnect keeps the cache", async () => {
  const boardUrl = penpotBoardUrl(penpot.url);
  await expect(link(boardUrl)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  await rpc.handle({ method: "connectPenpot", url: penpot.url, token: PENPOT_TOKEN });
  expect(await stateOf("penpot")).toMatchObject({ state: "connected" });
  expect(await link(boardUrl)).toMatchObject({ kind: "penpot_board", name: "Fiche" });
  const frame = await rpc.handle({ method: "getDesignFrame", url: boardUrl, refresh: false });
  expect(frame).toMatchObject({ provider: "penpot", name: "Fiche", stale: false });
  expect(await rpc.handle({ method: "disconnectIntegration", id: "penpot" })).toBeNull();
  expect(await stateOf("penpot")).toMatchObject({ state: "disconnected" });
  expect(await rpc.handle({ method: "getDesignFrame", url: boardUrl, refresh: true })).toMatchObject({
    stale: true,
    reachable: false,
  });
});

test("storybook: the shell and ticket links refuse a story, components list the project origins", async () => {
  const sb = startFakeStorybook();
  try {
    createProjectSettings(host.db).set(
      host.projectId,
      LOCAL_STORYBOOK_KEY,
      JSON.stringify({ origin: sb.url, portEnv: "STORYBOOK_PORT" }),
    );
    const story = `${sb.url}/?path=/story/screens-home--default`;
    await expect(rpc.handle({ method: "getDesignFrame", url: story, refresh: false })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(link(story)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const ctx = { projectId: host.projectId, instanceId: "w1" };
    expect(await rpc.hooks.design?.storybooks(ctx)).toEqual([
      { label: "Projet", origin: sb.url, branch: null, path: null, reachable: true },
    ]);
    await expect(
      rpc.hooks.design?.frame(ctx, "http://localhost:6006/?path=/story/screens-home--default", false),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(sb.requests.map((r) => r.path)).toEqual(["/iframe.html"]);
  } finally {
    sb.stop();
  }
});
