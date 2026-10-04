import { expect, mock, spyOn, test } from "bun:test";
import { KiboError, type RpcRequest, UPLOAD_CHUNK_BYTES } from "@kibo/schema";
import { base64ToBytes } from "@kibo/sdk/lib/base64";
import { chunksOf, uploadFile } from "./upload";

const asset = { name: "robot.glb", mime: "model/gltf-binary", kind: "model", size: 0, mtime: 1 } as const;

function fakeRpc(fail?: (req: RpcRequest) => Error | null) {
  const calls: RpcRequest[] = [];
  let received = 0;
  let inFlight = 0;
  let overlapped = false;
  const rpc = mock(async (req: RpcRequest): Promise<unknown> => {
    calls.push(req);
    inFlight += 1;
    if (inFlight > 1) overlapped = true;
    await Promise.resolve();
    inFlight -= 1;
    const error = fail?.(req);
    if (error) throw error;
    if (req.method === "beginAssetUpload") return { uploadId: "u1" };
    if (req.method === "appendAssetUpload") {
      received += base64ToBytes(req.bytes).byteLength;
      return { received };
    }
    if (req.method === "finishAssetUpload") return { ...asset, size: received };
    return null;
  });
  return { client: { rpc } as never, calls, overlapped: () => overlapped };
}

test("chunksOf cuts a size in chunks of UPLOAD_CHUNK_BYTES", () => {
  expect(chunksOf(0)).toEqual([]);
  expect(chunksOf(10)).toEqual([{ index: 0, start: 0, end: 10 }]);
  const chunks = chunksOf(UPLOAD_CHUNK_BYTES * 2 + 1);
  expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
  const last = chunks[2];
  expect(last && last.end - last.start).toBe(1);
  expect(chunks[1]).toEqual({ index: 1, start: UPLOAD_CHUNK_BYTES, end: UPLOAD_CHUNK_BYTES * 2 });
});

test("uploadFile begins, appends every chunk in order one at a time, then finishes", async () => {
  const fake = fakeRpc();
  const size = UPLOAD_CHUNK_BYTES * 2 + 5;
  const progress: number[] = [];
  const file = new Blob([new Uint8Array(size).fill(7)]);
  const done = await uploadFile(fake.client, "p1", "robot.glb", "model/gltf-binary", file, (r) =>
    progress.push(r),
  );
  expect(done.size).toBe(size);
  expect(fake.calls.map((c) => c.method)).toEqual([
    "beginAssetUpload",
    "appendAssetUpload",
    "appendAssetUpload",
    "appendAssetUpload",
    "finishAssetUpload",
  ]);
  expect(fake.calls[0]).toEqual({
    method: "beginAssetUpload",
    projectId: "p1",
    name: "robot.glb",
    mime: "model/gltf-binary",
    size,
  });
  expect(fake.calls.flatMap((c) => (c.method === "appendAssetUpload" ? [c.index] : []))).toEqual([0, 1, 2]);
  expect(progress).toEqual([UPLOAD_CHUNK_BYTES / size, (UPLOAD_CHUNK_BYTES * 2) / size, 1]);
  expect(fake.overlapped()).toBe(false);
});

test("a failed append cancels the upload after it settled, then rejects", async () => {
  const refused = new KiboError("NOT_FOUND", "upload u1 not found");
  const fake = fakeRpc((req) => (req.method === "appendAssetUpload" && req.index === 1 ? refused : null));
  const file = new Blob([new Uint8Array(UPLOAD_CHUNK_BYTES + 1)]);
  await expect(uploadFile(fake.client, "p1", "robot.glb", "model/gltf-binary", file)).rejects.toBe(refused);
  expect(fake.calls.map((c) => c.method)).toEqual([
    "beginAssetUpload",
    "appendAssetUpload",
    "appendAssetUpload",
    "cancelAssetUpload",
  ]);
  expect(fake.calls.at(-1)).toEqual({ method: "cancelAssetUpload", uploadId: "u1" });
  expect(fake.overlapped()).toBe(false);
});

test("a refused begin has nothing to cancel", async () => {
  const conflict = new KiboError("CONFLICT", "exists");
  const fake = fakeRpc((req) => (req.method === "beginAssetUpload" ? conflict : null));
  await expect(
    uploadFile(fake.client, "p1", "robot.glb", "model/gltf-binary", new Blob([new Uint8Array(3)])),
  ).rejects.toBe(conflict);
  expect(fake.calls.map((c) => c.method)).toEqual(["beginAssetUpload"]);
});

test("an aborted upload stops after the append in flight and cancels", async () => {
  const controller = new AbortController();
  const fake = fakeRpc();
  const file = new Blob([new Uint8Array(UPLOAD_CHUNK_BYTES * 3)]);
  const run = uploadFile(
    fake.client,
    "p1",
    "robot.glb",
    "model/gltf-binary",
    file,
    () => controller.abort(),
    controller.signal,
  );
  await expect(run).rejects.toMatchObject({ name: "AbortError" });
  expect(fake.calls.map((c) => c.method)).toEqual([
    "beginAssetUpload",
    "appendAssetUpload",
    "cancelAssetUpload",
  ]);
});

test("a failed cancel is logged and the first error is kept", async () => {
  const refused = new KiboError("INVALID_INPUT", "not a glb");
  const fake = fakeRpc((req) =>
    req.method === "finishAssetUpload"
      ? refused
      : req.method === "cancelAssetUpload"
        ? new Error("down")
        : null,
  );
  const error = spyOn(console, "error").mockImplementation(() => {});
  await expect(
    uploadFile(fake.client, "p1", "robot.glb", "model/gltf-binary", new Blob([new Uint8Array(3)])),
  ).rejects.toBe(refused);
  expect(error).toHaveBeenCalledTimes(1);
  error.mockRestore();
});
