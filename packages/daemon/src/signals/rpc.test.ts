import { expect, test } from "bun:test";
import {
  type Actor,
  KiboError,
  type RpcRequest,
  SIGNAL_RPC,
  type Signal,
  type SignalsView,
} from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { signalRpc } from "./rpc";
import { fakeSignals } from "./signals.test-helper";

function rig(writable = true) {
  const calls: string[] = [];
  const signals = fakeSignals();
  const first = signals.add(1);
  const service = {
    list(projectId: string): SignalsView {
      calls.push(`list:${projectId}`);
      return signals.list(projectId);
    },
    ignore(projectId: string, signalId: string, by: Actor): Signal {
      calls.push(`ignore:${projectId}:${signalId}:${by.kind}:${by.ref}`);
      return first;
    },
  };
  const data = {
    assertWritable(projectId: string) {
      calls.push(`assert:${projectId}`);
      if (!writable) throw new KiboError("PERMISSION_DENIED", "read only");
    },
    viewer: () => "adam",
  };
  const rpc = signalRpc(service, data, () => calls.push("emit"));
  return { rpc, calls };
}

test("the extension serves the two signal methods for editors", async () => {
  const { rpc, calls } = rig();
  expect([...rpc.methods]).toEqual(SIGNAL_RPC.map((s) => s.shape.method.value));
  const view = await rpc.handle({ method: "listSignals", projectId: "p1" }, LOCAL_CONTEXT);
  expect(view).toMatchObject({ signals: [{ ref: "sig:1" }] });
  await rpc.handle({ method: "ignoreSignal", projectId: "p1", signalId: "s1" }, LOCAL_CONTEXT);
  expect(calls).toEqual(["assert:p1", "list:p1", "assert:p1", "ignore:p1:s1:human:adam", "emit"]);
});

test("a reader can neither list nor ignore signals", async () => {
  const { rpc, calls } = rig(false);
  await expect(rpc.handle({ method: "listSignals", projectId: "p1" }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "PERMISSION_DENIED",
  });
  await expect(
    rpc.handle({ method: "ignoreSignal", projectId: "p1", signalId: "s1" }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  expect(calls).toEqual(["assert:p1", "assert:p1"]);
});

test("another method is refused", async () => {
  const { rpc, calls } = rig();
  const req: RpcRequest = { method: "getAgents" };
  await expect(rpc.handle(req, LOCAL_CONTEXT)).rejects.toMatchObject({ code: "INTERNAL" });
  expect(calls).toEqual([]);
});
