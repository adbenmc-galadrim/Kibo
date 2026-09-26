export const BACKEND_MESSAGE_LIMIT = 4 * 1024 * 1024;

export type LineSink = { line(text: string): void; overflow(): void };

const NEWLINE = 10;

export async function readLines(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  sink: LineSink,
): Promise<void> {
  const decoder = new TextDecoder();
  let parts: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stream) {
    let start = 0;
    for (let end = chunk.indexOf(NEWLINE); end !== -1; end = chunk.indexOf(NEWLINE, start)) {
      size += end - start;
      if (size > limit) return sink.overflow();
      parts.push(chunk.subarray(start, end));
      sink.line(decoder.decode(Buffer.concat(parts)));
      parts = [];
      size = 0;
      start = end + 1;
    }
    size += chunk.byteLength - start;
    if (size > limit) return sink.overflow();
    parts.push(chunk.slice(start));
  }
}
