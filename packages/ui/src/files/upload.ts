import { type ProjectAsset, type ProjectAssetMime, UPLOAD_CHUNK_BYTES } from "@kibo/schema";
import type { KiboClient } from "@kibo/sdk";
import { bytesToBase64 } from "@kibo/sdk/lib/base64";

export type UploadRpc = Pick<KiboClient, "rpc">;
export type Chunk = { index: number; start: number; end: number };

export const chunksOf = (size: number): Chunk[] =>
  Array.from({ length: Math.ceil(size / UPLOAD_CHUNK_BYTES) }, (_, index) => ({
    index,
    start: index * UPLOAD_CHUNK_BYTES,
    end: Math.min(size, (index + 1) * UPLOAD_CHUNK_BYTES),
  }));

async function sendChunks(
  client: UploadRpc,
  uploadId: string,
  file: Blob,
  onProgress: (ratio: number) => void,
  signal: AbortSignal | undefined,
): Promise<ProjectAsset> {
  for (const chunk of chunksOf(file.size)) {
    signal?.throwIfAborted();
    const bytes = new Uint8Array(await file.slice(chunk.start, chunk.end).arrayBuffer());
    const { received } = await client.rpc({
      method: "appendAssetUpload",
      uploadId,
      index: chunk.index,
      bytes: bytesToBase64(bytes),
    });
    onProgress(received / file.size);
  }
  signal?.throwIfAborted();
  return client.rpc({ method: "finishAssetUpload", uploadId });
}

export async function uploadFile(
  client: UploadRpc,
  projectId: string,
  name: string,
  mime: ProjectAssetMime,
  file: Blob,
  onProgress: (ratio: number) => void = () => {},
  signal?: AbortSignal,
): Promise<ProjectAsset> {
  signal?.throwIfAborted();
  const { uploadId } = await client.rpc({
    method: "beginAssetUpload",
    projectId,
    name,
    mime,
    size: file.size,
  });
  try {
    return await sendChunks(client, uploadId, file, onProgress, signal);
  } catch (e) {
    await client
      .rpc({ method: "cancelAssetUpload", uploadId })
      .catch((c: unknown) => console.error("[kibo-ui] upload not cancelled", c));
    throw e;
  }
}
