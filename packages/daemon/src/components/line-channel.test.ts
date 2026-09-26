import { expect, test } from "bun:test";
import { readLines } from "./line-channel";

const bytes = (text: string) => new TextEncoder().encode(text);
const stream = (...chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(chunk);
      c.close();
    },
  });

async function collect(limit: number, ...chunks: Uint8Array[]) {
  const lines: string[] = [];
  let overflow = false;
  await readLines(stream(...chunks), limit, {
    line: (l) => lines.push(l),
    overflow: () => {
      overflow = true;
    },
  });
  return { lines, overflow };
}

test("lines are split across chunks, even inside a multibyte character", async () => {
  const e = bytes('{"b":"é"}\n');
  expect(
    await collect(100, bytes('{"a":'), bytes('1}\n{"b'), e.subarray(3, 7), e.subarray(7), bytes('{"c":3}\n')),
  ).toEqual({
    lines: ['{"a":1}', '{"b":"é"}', '{"c":3}'],
    overflow: false,
  });
});

test("a line longer than the limit stops the reading, with or without its newline", async () => {
  expect(await collect(8, bytes("12345678\n"), bytes("123456789\nlost\n"))).toEqual({
    lines: ["12345678"],
    overflow: true,
  });
  expect(await collect(8, bytes("1234"), bytes("56789"))).toEqual({ lines: [], overflow: true });
});
