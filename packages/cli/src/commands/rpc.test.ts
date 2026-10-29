import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DaemonError } from "../daemon-client";
import { rpcCommand } from "./rpc";
import { type FakeDaemonOptions, fakeDaemon } from "./tickets-test-kit";

const dir = mkdtempSync(join(tmpdir(), "kibo-rpc-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const echo: FakeDaemonOptions["raw"] = (body) => ({ received: body });

async function rpc(arg: string | undefined, options: FakeDaemonOptions = { raw: echo }, stdin = () => "") {
  const d = fakeDaemon(undefined, undefined, options);
  const positional = arg === undefined ? ["rpc"] : ["rpc", arg];
  const code = await rpcCommand(positional, {}, d.io, d.connect, dir, stdin);
  return { ...d, code };
}

describe("kibo rpc", () => {
  test("sends the body as is and prints the result", async () => {
    const d = await rpc('{"method":"getProject","projectId":"p-silo","extra":[1]}');
    expect(d.code).toBe(0);
    const body = { method: "getProject", projectId: "p-silo", extra: [1] };
    expect(d.raws).toEqual([body]);
    expect(d.out).toEqual([JSON.stringify({ received: body }, null, 2)]);
    expect(d.err).toEqual([]);
  });

  test("reads @file and @-", async () => {
    writeFileSync(join(dir, "requete.json"), '{"method":"listProjects"}');
    expect((await rpc("@requete.json")).raws).toEqual([{ method: "listProjects" }]);
    const piped = await rpc("@-", { raw: echo }, () => '{"method":"getAppInfo"}');
    expect(piped.raws).toEqual([{ method: "getAppInfo" }]);
  });

  test("a malformed JSON is a usage error (2)", async () => {
    const d = await rpc("{method:");
    expect(d.code).toBe(2);
    expect(d.err[0]).toStartWith("JSON illisible : ");
    expect(d.err.join("\n")).toContain("kibo rpc '<json>' | @fichier | @-");
    expect(d.raws).toEqual([]);
  });

  test("a body without a method, or no body, is a usage error (2)", async () => {
    for (const arg of ['["getProject"]', '{"projectId":"p-silo"}', '{"method":3}', undefined]) {
      const d = await rpc(arg);
      expect(d.code).toBe(2);
      expect(d.err.join("\n")).toContain("kibo rpc '<json>' | @fichier | @-");
      expect(d.raws).toEqual([]);
    }
  });

  test("a daemon error prints Erreur CODE and exits 1", async () => {
    const d = await rpc('{"method":"command"}', {
      raw: () => {
        throw new DaemonError("INVALID_INPUT", "invalid request: projectId, command");
      },
    });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Erreur INVALID_INPUT : invalid request: projectId, command"]);
    expect(d.out).toEqual([]);
  });

  test("the session is closed", async () => {
    expect((await rpc('{"method":"listProjects"}')).closed()).toBe(1);
    const failed = await rpc('{"method":"command"}', {
      raw: () => {
        throw new DaemonError("NOT_FOUND", "project p-x not found");
      },
    });
    expect(failed.closed()).toBe(1);
  });
});
