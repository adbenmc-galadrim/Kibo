import { beforeEach, expect, test } from "bun:test";
import type { ExternalRef, RpcRequest, TicketView } from "../packages/schema/src/index";
import { createMemoryDaemon, type MemoryDaemon, memorySeed } from "./fixtures/memory-daemon";
import { SILO_APERCU_FRAME, SILO_APERCU_TICKET } from "./fixtures/silo-apercu";
import { SILO_PROJECT, siloKey } from "./fixtures/silo-maquettes";
import { seedSiloApercu } from "./seed-silo-apercu";
import type { SeedRpc } from "./seed-silo-maquettes";
import { E2E_FIGMA_TOKEN } from "./token";

const TODAY = "2026-10-16";
const DESIGN_METHODS = ["listIntegrations", "connectFigma", "linkDesignFrame"];

type Figma = { connected: boolean };

let daemon: MemoryDaemon;
let figma: Figma;
let sent: RpcRequest[];

function designRpc(memory: MemoryDaemon, state: Figma, log: RpcRequest[]): SeedRpc {
  return async (req) => {
    log.push(req);
    switch (req.method) {
      case "listIntegrations":
        return [{ id: "figma", state: state.connected ? "connected" : "disconnected" }];
      case "connectFigma":
        state.connected = true;
        return { id: "figma", state: "connected" };
      case "linkDesignFrame": {
        const ref: ExternalRef = {
          kind: "figma_node",
          fileKey: SILO_APERCU_FRAME.fileKey,
          nodeId: SILO_APERCU_FRAME.nodeId,
          url: req.url,
          name: SILO_APERCU_FRAME.name,
        };
        const command = { method: "upsertExternalRef", ticketId: req.ticketId, ref } as const;
        await memory.rpc({ method: "command", projectId: req.projectId, command });
        return ref;
      }
      default:
        return memory.rpc(req);
    }
  };
}

beforeEach(() => {
  daemon = createMemoryDaemon("adam", TODAY);
  figma = { connected: false };
  sent = [];
});

const seed = () => seedSiloApercu(designRpc(daemon, figma, sent), memorySeed(daemon));
const designCalls = () => sent.filter((r) => DESIGN_METHODS.includes(r.method));
const conflicts = (): TicketView => {
  const found = daemon
    .snapshot(SILO_PROJECT.key, TODAY)
    .tickets.find((t) => t.key === siloKey(SILO_APERCU_TICKET));
  if (found === undefined) throw new Error("SILO-45 is missing");
  return found;
};

test("after the whole Silo seed, Figma is connected with the test token, then the frame is linked to SILO-45", async () => {
  const result = await seed();
  const last = sent.slice(-3);
  expect(last.map((r) => r.method)).toEqual(["listIntegrations", "connectFigma", "linkDesignFrame"]);
  expect(last[1]).toEqual({ method: "connectFigma", auth: { mode: "token", token: E2E_FIGMA_TOKEN } });
  expect(last[2]).toMatchObject({
    method: "linkDesignFrame",
    projectId: result.projectId,
    ticketId: conflicts().id,
    url: SILO_APERCU_FRAME.url,
  });
});

test("SILO-45 carries the « Conflit de saisie » frame and only it", async () => {
  await seed();
  expect(conflicts().externalRefs.filter((r) => r.kind === "figma_node")).toEqual([
    {
      kind: "figma_node",
      fileKey: "AbC123xyz",
      nodeId: "45:1",
      url: SILO_APERCU_FRAME.url,
      name: "Conflit de saisie",
    },
  ]);
});

test("a second seed connects nothing and links nothing again", async () => {
  await seed();
  const before = daemon.writes();
  sent.length = 0;
  await seed();
  expect(designCalls().map((r) => r.method)).toEqual(["listIntegrations"]);
  expect(daemon.writes()).toBe(before);
});

test("a Figma already connected is not connected again, the frame is still linked", async () => {
  figma.connected = true;
  await seed();
  expect(designCalls().map((r) => r.method)).toEqual(["listIntegrations", "linkDesignFrame"]);
});

test("the declared frame is the PNG of the P8g mockup, 444 × 960", async () => {
  const png = new Uint8Array(
    await Bun.file(new URL(`../${SILO_APERCU_FRAME.png}`, import.meta.url)).arrayBuffer(),
  );
  const view = new DataView(png.buffer);
  expect([view.getUint32(16), view.getUint32(20)]).toEqual([
    SILO_APERCU_FRAME.width,
    SILO_APERCU_FRAME.height,
  ]);
});
