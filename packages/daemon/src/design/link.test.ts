import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { DesignFrameKey } from "@kibo/schema";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { linkDesignFrame } from "./link";
import type { FrameMeta } from "./providers/types";

const FIGMA_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const PENPOT_URL =
  "http://localhost:9010/#/workspace/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333?page-id=44444444-4444-4444-8444-444444444444&board-id=55555555-5555-4555-8555-555555555555";

let host: FakeHost;
let ticketId: string;
let connected: { figma: boolean; penpot: boolean };
const metadata = mock(
  async (_key: DesignFrameKey): Promise<FrameMeta> => ({
    name: `Tickets ${"x".repeat(300)}`,
    width: 1,
    height: 1,
  }),
);
const link = (url: string, penpotInstance: string | null = "http://localhost:9010") =>
  linkDesignFrame(
    {
      host,
      service: { metadata },
      providers: {
        figma: { connected: async () => connected.figma },
        penpot: { connected: async () => connected.penpot },
      },
      penpotInstance: () => penpotInstance,
    },
    host.projectId,
    ticketId,
    url,
  );
const refsOfTicket = () => host.snapshot(host.projectId).tickets.find((t) => t.id === ticketId)?.externalRefs;

beforeEach(() => {
  host = createFakeHost();
  connected = { figma: true, penpot: true };
  metadata.mockClear();
  ticketId = host.command(
    host.projectId,
    { method: "createTicket", title: "Arbre" },
    { origin: "user", instanceId: null },
  ).id;
});
afterEach(() => host.close());

test("a figma url links a figma node named by the provider, bounded to 200 characters", async () => {
  const ref = await link(FIGMA_URL);
  expect(ref).toMatchObject({ kind: "figma_node", fileKey: "AbC123xyz", nodeId: "12:34", url: FIGMA_URL });
  expect(ref.kind === "figma_node" && ref.name.length).toBe(200);
  expect(refsOfTicket()).toEqual([ref]);
});

test("a penpot url links a penpot board", async () => {
  const ref = await link(PENPOT_URL);
  expect(ref).toMatchObject({
    kind: "penpot_board",
    instance: "http://localhost:9010",
    fileId: "33333333-3333-4333-8333-333333333333",
    boardId: "55555555-5555-4555-8555-555555555555",
  });
  expect(refsOfTicket()).toEqual([ref]);
});

test("a provider not connected is refused and nothing is written", async () => {
  connected.penpot = false;
  await expect(link(PENPOT_URL)).rejects.toThrow("NOT_CONNECTED");
  expect(metadata).not.toHaveBeenCalled();
  expect(refsOfTicket()).toEqual([]);
});

test("an invalid url or another penpot instance is refused before any request", async () => {
  await expect(link("javascript:alert(1)")).rejects.toThrow("INVALID_INPUT");
  await expect(link(PENPOT_URL, "https://design.penpot.app")).rejects.toThrow("INVALID_INPUT");
  await expect(link(PENPOT_URL.replace("http://localhost:9010", "https://127.0.0.1"), null)).rejects.toThrow(
    "INVALID_INPUT",
  );
  expect(metadata).not.toHaveBeenCalled();
  expect(refsOfTicket()).toEqual([]);
});
