import { describe, expect, test } from "bun:test";
import { KiboError, type Link } from "@kibo/schema";
import type { DaemonClient } from "../daemon-client";
import { runTicketsCommand } from "./tickets";
import { type FakeDaemonOptions, fakeDaemon, SILO_META } from "./tickets-test-kit";

const BLOCKS: Link = { id: "l1", from: "a", to: "b", type: "blocks" };

function withLinks(client: DaemonClient, links: Link[]): DaemonClient {
  return {
    ...client,
    async rpc(req) {
      if (req.method !== "getProject") return client.rpc(req);
      const snapshot = await client.rpc({ method: "getProject", projectId: SILO_META.id });
      return { ...snapshot, links } as never;
    },
  };
}

async function tickets(
  positional: string[],
  flags: Record<string, string | true>,
  options: FakeDaemonOptions & { links?: Link[] } = {},
) {
  const d = fakeDaemon(undefined, undefined, options);
  const client = withLinks(d.client, options.links ?? []);
  const code = await runTicketsCommand(positional, flags, d.io, async () => client, "/nowhere");
  return { ...d, code };
}

describe("kibo tickets link", () => {
  test("link A --blocks B sends from A to B", async () => {
    const d = await tickets(["link", "SILO-33"], { blocks: "SILO-34" });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([{ method: "addLink", from: "a", to: "b", type: "blocks" }]);
    expect(d.out).toEqual(["✓ SILO-33 bloque SILO-34"]);
  });

  test("--json prints the link", async () => {
    const d = await tickets(["link", "SILO-33"], { blocks: "SILO-34", json: true });
    expect(d.code).toBe(0);
    expect(JSON.parse(d.out.join("\n"))).toEqual({ id: "l-1", from: "a", to: "b", type: "blocks" });
  });

  test("an unknown ticket is not found and sends nothing", async () => {
    const d = await tickets(["link", "SILO-33"], { blocks: "SILO-99" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Ticket introuvable : SILO-99"]);
    expect(d.commands()).toEqual([]);
  });

  test("a cycle is translated", async () => {
    const d = await tickets(
      ["link", "SILO-34"],
      { blocks: "SILO-33" },
      {
        onCommand: () => {
          throw new KiboError("LINK_CYCLE", "this dependency would create a cycle");
        },
      },
    );
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Cette dépendance créerait un cycle : SILO-34 dépend déjà de SILO-33."]);
  });

  test("an existing link is translated", async () => {
    const d = await tickets(
      ["link", "SILO-33"],
      { blocks: "SILO-34" },
      {
        onCommand: () => {
          throw new KiboError("INVALID_INPUT", "link already exists");
        },
      },
    );
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Ce lien existe déjà."]);
  });

  test("an error without translation goes up untouched", async () => {
    const run = tickets(
      ["link", "SILO-33"],
      { blocks: "SILO-34" },
      {
        onCommand: () => {
          throw new KiboError("INTERNAL", "disk full");
        },
      },
    );
    await expect(run).rejects.toThrow("disk full");
  });
});

describe("kibo tickets unlink", () => {
  test("unlink removes the blocks link from A to B", async () => {
    const d = await tickets(["unlink", "SILO-33", "SILO-34"], {}, { links: [BLOCKS] });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([{ method: "removeLink", linkId: "l1" }]);
    expect(d.out).toEqual(["✓ SILO-33 ne bloque plus SILO-34"]);
  });

  test("--json prints the removed link", async () => {
    const d = await tickets(["unlink", "SILO-33", "SILO-34"], { json: true }, { links: [BLOCKS] });
    expect(JSON.parse(d.out.join("\n"))).toEqual(BLOCKS);
  });

  test("unlink in the other direction is not found", async () => {
    const d = await tickets(["unlink", "SILO-34", "SILO-33"], {}, { links: [BLOCKS] });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["SILO-34 ne bloque pas SILO-33"]);
    expect(d.commands()).toEqual([]);
  });

  test("a relates link is not removed", async () => {
    const d = await tickets(
      ["unlink", "SILO-33", "SILO-34"],
      {},
      { links: [{ ...BLOCKS, type: "relates" }] },
    );
    expect(d.code).toBe(1);
    expect(d.commands()).toEqual([]);
  });
});
