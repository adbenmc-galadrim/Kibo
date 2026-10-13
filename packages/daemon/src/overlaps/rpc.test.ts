import { afterEach, expect, test } from "bun:test";
import { KiboError, OVERLAP_RPC, type OverlapDetail, type ParallelWork, type RpcRequest } from "@kibo/schema";
import { cleanupTmp, tmp } from "../agents/git-test-kit";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { overlapRpc } from "./rpc";
import { openOverlapStore } from "./store";

afterEach(cleanupTmp);

const REMOTE: RpcContext = { sessionHash: "r", remote: true };
const NOW = 1_000;
const EXPORT: OverlapDetail = { kind: "export", name: "formatDate", ownerPath: "a.ts", otherPath: "b.ts" };
const BLOCK: OverlapDetail = {
  kind: "block",
  ownerPath: "src/api/client.ts",
  ownerStart: 1,
  otherPath: "src/http.ts",
  otherStart: 1,
  lines: 14,
  chars: 400,
};
const WORK: ParallelWork = { runs: [], more: 0, overlaps: [], partial: false };

function scene(readOnly: readonly string[] = []) {
  const store = openOverlapStore(tmp());
  const make = (detail: OverlapDetail, key: string, owner: string, other: string, projectId = "P") =>
    store.create(
      {
        kind: detail.kind,
        key,
        ownerWorkspace: `/w/${owner}`,
        otherWorkspace: `/w/${other}`,
        ownerRunId: owner,
        otherRunId: other,
        detail,
      },
      projectId,
      NOW,
    );
  const ab = make(EXPORT, "export:formatDate", "ra", "rb");
  const ac = make(EXPORT, "export:formatDate", "ra", "rc");
  const bc = make(BLOCK, "block:abc", "rb", "rc");
  const q = make(EXPORT, "export:formatDate", "rq", "rr", "Q");
  let emitted = 0;
  const cancelled: string[] = [];
  const rpc = overlapRpc({
    store,
    read: async (id) => ({
      owner: { runId: "ra", runName: "A", path: id, content: "x", reason: null },
      other: { runId: "rb", runName: "B", path: id, content: null, reason: "fichier absent" },
    }),
    parallelWork: async (runId) => {
      if (runId !== "ra") throw new KiboError("NOT_FOUND", `run ${runId} not found`);
      return WORK;
    },
    linker: {
      cancel(id, by) {
        cancelled.push(`${id}:${by.ref}`);
        const link = store.autoLink.get(id);
        if (!link) throw new KiboError("NOT_FOUND", id);
        return store.autoLink.event(id, { type: "cancelled", by, at: NOW });
      },
    },
    data: {
      viewer: () => "Adam",
      assertWritable(projectId) {
        if (readOnly.includes(projectId)) throw new KiboError("FORBIDDEN", "read-only project");
      },
    },
    emit: () => {
      emitted++;
    },
    now: () => NOW,
  });
  const call = (req: RpcRequest, ctx: RpcContext = LOCAL_CONTEXT) => rpc.handle(req, ctx);
  return { store, rpc, call, ab, ac, bc, q, cancelled, emitted: () => emitted };
}

test("the extension serves every overlap method, from this machine only", async () => {
  const s = scene();
  expect([...s.rpc.methods]).toEqual(OVERLAP_RPC.map((r) => r.shape.method.value));
  await expect(s.call({ method: "overlaps.list", projectId: "P" }, REMOTE)).rejects.toThrow("FORBIDDEN");
  await expect(s.call({ method: "listProjects" })).rejects.toThrow("INTERNAL");
});

test("overlaps.list filters by project, run and state; open without filter lists every open one", async () => {
  const s = scene();
  const ids = async (req: RpcRequest) => ((await s.call(req)) as { id: string }[]).map((o) => o.id).sort();
  expect(await ids({ method: "overlaps.list", projectId: "P" })).toEqual([s.ab.id, s.ac.id, s.bc.id].sort());
  expect(await ids({ method: "overlaps.list", runId: "rc" })).toEqual([s.ac.id, s.bc.id].sort());
  s.store.event(s.bc.id, { type: "resolved", role: null, by: null, at: NOW });
  expect(await ids({ method: "overlaps.list", state: "open" })).toEqual([s.ab.id, s.ac.id, s.q.id].sort());
  expect(await ids({ method: "overlaps.list", projectId: "P", state: "resolved" })).toEqual([s.bc.id]);
});

test("ignoring settles every open overlap of the same key in the project, by a readable name, once", async () => {
  const s = scene();
  const ignored = await s.call({ method: "overlaps.ignore", id: s.ab.id });
  const adam = { kind: "human", ref: "Adam" };
  expect(ignored).toMatchObject({ id: s.ab.id, status: "ignored", ignoredBy: adam, ignoredAt: NOW });
  expect(s.store.get(s.ac.id)?.status).toBe("ignored");
  expect(s.store.get(s.bc.id)?.status).toBe("open");
  expect(s.store.get(s.q.id)?.status).toBe("open");
  expect(s.store.ignoredKeys("P")).toEqual(new Set(["export:formatDate"]));
  expect(s.emitted()).toBe(1);
  await s.call({ method: "overlaps.ignore", id: s.ab.id });
  expect(await s.call({ method: "overlaps.ignored", projectId: "P" })).toEqual([
    { projectId: "P", kind: "export", key: "export:formatDate", label: "`formatDate`", by: adam, at: NOW },
  ]);
  await s.call({ method: "overlaps.ignore", id: s.bc.id });
  expect(
    ((await s.call({ method: "overlaps.ignored", projectId: "P" })) as { label: string }[]).map(
      (i) => i.label,
    ),
  ).toEqual(["`formatDate`", "bloc de 14 lignes (`src/api/client.ts`)"]);
  await expect(s.call({ method: "overlaps.ignore", id: "nope" })).rejects.toThrow("NOT_FOUND");
});

test("a reader cannot ignore, reactivate nor cancel", async () => {
  const s = scene(["P"]);
  await expect(s.call({ method: "overlaps.ignore", id: s.ab.id })).rejects.toThrow("FORBIDDEN");
  await expect(
    s.call({ method: "overlaps.reactivate", projectId: "P", kind: "export", key: "export:formatDate" }),
  ).rejects.toThrow("FORBIDDEN");
  const link = s.store.autoLink.create(autoLinkRow());
  await expect(s.call({ method: "autoLinks.cancel", id: link.id })).rejects.toThrow("FORBIDDEN");
  expect(s.cancelled).toEqual([]);
  expect(s.store.get(s.ab.id)?.status).toBe("open");
});

test("reactivating a full key lets it alert again", async () => {
  const s = scene();
  await s.call({ method: "overlaps.ignore", id: s.ab.id });
  expect(
    await s.call({ method: "overlaps.reactivate", projectId: "P", kind: "export", key: "export:formatDate" }),
  ).toEqual({ ok: true });
  expect(s.store.ignoredKeys("P")).toEqual(new Set());
  expect(s.emitted()).toBe(2);
});

test("overlaps.read and overlaps.parallel pass through their services", async () => {
  const s = scene();
  expect(await s.call({ method: "overlaps.read", id: s.ab.id })).toMatchObject({
    owner: { path: s.ab.id, content: "x" },
    other: { content: null, reason: "fichier absent" },
  });
  expect(await s.call({ method: "overlaps.parallel", runId: "ra" })).toEqual(WORK);
  await expect(s.call({ method: "overlaps.parallel", runId: "zz" })).rejects.toThrow("NOT_FOUND");
});

const autoLinkRow = () => ({
  projectId: "P",
  linkId: "l1",
  fromTicketId: "t12",
  toTicketId: "t15",
  fromTicketKey: "BOU-12",
  toTicketKey: "BOU-15",
  ownerRunId: "ra",
  otherRunId: "rb",
  reason: "import" as const,
  detail: { path: "src/lib/format.ts", name: "formatDate" },
  at: NOW,
});

test("autoLinks.list lists the project links; cancel goes through the linker as the viewer", async () => {
  const s = scene();
  const link = s.store.autoLink.create(autoLinkRow());
  expect(await s.call({ method: "autoLinks.list", projectId: "P" })).toEqual([link]);
  expect(await s.call({ method: "autoLinks.list", projectId: "Q" })).toEqual([]);
  expect(await s.call({ method: "autoLinks.cancel", id: link.id })).toMatchObject({
    status: "cancelled",
    cancelledBy: { kind: "human", ref: "Adam" },
  });
  expect(s.cancelled).toEqual([`${link.id}:Adam`]);
  expect(s.emitted()).toBe(1);
  await expect(s.call({ method: "autoLinks.cancel", id: "nope" })).rejects.toThrow("NOT_FOUND");
});
