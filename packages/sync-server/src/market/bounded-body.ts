import { KiboError } from "@kibo/schema";

const tooLarge = (max: number) => new KiboError("TOO_LARGE", `request body exceeds ${max} bytes`);

function assertDeclaredLength(req: Request, max: number): void {
  const declared = req.headers.get("content-length");
  if (declared === null) return;
  if (!/^\d{1,16}$/.test(declared)) throw new KiboError("INVALID_INPUT", "invalid content-length");
  if (Number(declared) > max) throw tooLarge(max);
}

export async function readBoundedBody(req: Request, max: number): Promise<Uint8Array> {
  assertDeclaredLength(req, max);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw tooLarge(max);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
