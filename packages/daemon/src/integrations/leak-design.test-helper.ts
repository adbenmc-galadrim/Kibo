import { expect } from "bun:test";
import type { RpcRequest, RpcResult } from "@kibo/schema";
import { z } from "zod";
import { FAKE_FIGMA_IMAGE_HOST, type FakeFigma, startFakeFigma } from "../testing/fake-figma";
import { type FakePenpot, PENPOT_IDS, penpotBoardUrl, startFakePenpot } from "../testing/fake-penpot";

export const FIGMA_TOKEN = "figd_TESTSECRET0123456789abcdefghijklmn";
export const PENPOT_TOKEN = "penpot-TESTSECRET-0123456789abcdef";
export const FIGMA_NODE = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const MISSING_NODE = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=99-99";
const MISSING_BOARD = "66666666-6666-4666-8666-666666666666";

type Ok = <R extends RpcRequest>(req: R) => Promise<RpcResult[R["method"]]>;
type Call = (req: RpcRequest) => Promise<{ ok: boolean; text: string }>;
export type DesignFakes = { figma: FakeFigma; penpot: FakePenpot; origins: string; stop(): void };

const Created = z.object({ id: z.string() });
const Served = z.object({ url: z.string().url() });

export function startDesignFakes(): DesignFakes {
  const figma = startFakeFigma({ token: FIGMA_TOKEN, handle: "adam" });
  figma.addFile("AbC123xyz", "Kibo");
  figma.addNode("AbC123xyz", "12:34", { name: "Tickets" });
  const penpot = startFakePenpot({ token: PENPOT_TOKEN, fullname: "Adam" });
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board, { name: "Fiche" });
  return {
    figma,
    penpot,
    origins: `api.figma.com=${figma.url},${FAKE_FIGMA_IMAGE_HOST}=${figma.url}`,
    stop() {
      figma.stop();
      penpot.stop();
    },
  };
}

async function expectEchoRedacted(call: Call, req: RpcRequest): Promise<void> {
  const body = await call(req);
  expect(body.ok).toBe(false);
  expect(body.text).toContain("token ***");
}

export async function designScenario(
  fakes: DesignFakes,
  rpc: { ok: Ok; call: Call },
  projectId: string,
  ticketId: string,
): Promise<void> {
  const { ok, call } = rpc;
  const board = penpotBoardUrl(fakes.penpot.url);
  await ok({ method: "connectFigma", auth: { mode: "token", token: FIGMA_TOKEN } });
  await ok({ method: "connectPenpot", url: fakes.penpot.url, token: PENPOT_TOKEN });
  await ok({ method: "linkDesignFrame", projectId, ticketId, url: FIGMA_NODE });
  await ok({ method: "linkDesignFrame", projectId, ticketId, url: board });
  expect(await ok({ method: "getDesignFrame", url: FIGMA_NODE, refresh: true })).toMatchObject({
    stale: false,
  });
  expect(await ok({ method: "getDesignFrame", url: board, refresh: false })).toMatchObject({ stale: false });
  const page = Created.parse(
    await ok({ method: "command", projectId, command: { method: "addPage", title: "D", kind: "view" } }),
  );
  const widget = Created.parse(
    await ok({
      method: "command",
      projectId,
      command: { method: "addInstance", pageId: page.id, component: "tickets@1.0.0" },
    }),
  );
  const frame = Served.parse(
    await ok({
      method: "componentCall",
      projectId,
      instanceId: widget.id,
      call: { kind: "design.frame", url: FIGMA_NODE, refresh: false },
    }),
  );
  expect((await fetch(frame.url)).status).toBe(200);
  fakes.figma.failNext(500, `token ${FIGMA_TOKEN}`);
  await expectEchoRedacted(call, { method: "getDesignFrame", url: MISSING_NODE, refresh: false });
  fakes.penpot.failNext(500, `token ${PENPOT_TOKEN}`);
  await expectEchoRedacted(call, {
    method: "getDesignFrame",
    url: board.replace(PENPOT_IDS.board, MISSING_BOARD),
    refresh: false,
  });
  await ok({ method: "disconnectIntegration", id: "figma" });
  await ok({ method: "disconnectIntegration", id: "penpot" });
}
