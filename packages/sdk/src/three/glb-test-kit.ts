const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes: Uint8Array) => {
  let a = 1;
  let b = 0;
  for (const x of bytes) {
    a = (a + x) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
};

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

function chunk(type: string, data: number[]): number[] {
  const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}

export function checkerPng(
  size: number,
  a: [number, number, number],
  b: [number, number, number],
): Uint8Array {
  const raw: number[] = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) raw.push(...((Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? a : b));
  }
  const data = new Uint8Array(raw);
  const stored = [
    0x78,
    0x01,
    1,
    data.length & 0xff,
    data.length >>> 8,
    ~data.length & 0xff,
    (~data.length >>> 8) & 0xff,
  ];
  const idat = [...stored, ...data, ...u32(adler32(data))];
  const header = [...u32(size), ...u32(size), 8, 2, 0, 0, 0];
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk("IHDR", header),
    ...chunk("IDAT", idat),
    ...chunk("IEND", []),
  ]);
}

const QUAD = {
  positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  uvs: [0, 1, 1, 1, 1, 0, 0, 0],
  indices: [0, 1, 2, 0, 2, 3],
};

type Part = { bytes: Uint8Array; target?: number };

export const ORANGE: [number, number, number, number] = [0.98, 0.25, 0.02, 1];

export function coloredGlb(): Uint8Array<ArrayBuffer> {
  const parts: Part[] = [
    { bytes: new Uint8Array(new Float32Array(QUAD.positions).buffer), target: 34962 },
    { bytes: new Uint8Array(new Float32Array(QUAD.uvs).buffer), target: 34962 },
    { bytes: new Uint8Array(new Uint16Array(QUAD.indices).buffer), target: 34963 },
    {
      bytes: new Uint8Array(
        new Float32Array([0, 0.8, 0.1, 1, 0, 0.8, 0.1, 1, 0.1, 0.2, 0.9, 1, 0.1, 0.2, 0.9, 1]).buffer,
      ),
      target: 34962,
    },
    { bytes: checkerPng(64, [220, 30, 30], [30, 60, 220]) },
  ];
  const views: Record<string, number>[] = [];
  const chunks: number[] = [];
  for (const part of parts) {
    while (chunks.length % 4 !== 0) chunks.push(0);
    views.push({
      buffer: 0,
      byteOffset: chunks.length,
      byteLength: part.bytes.byteLength,
      ...(part.target ? { target: part.target } : {}),
    });
    chunks.push(...part.bytes);
  }
  while (chunks.length % 4 !== 0) chunks.push(0);
  const node = (mesh: number, x: number) => ({
    mesh,
    name: ["Flat", "Textured", "Painted"][mesh],
    translation: [x, 0, 0],
  });
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [node(0, -1.2), node(1, 0), node(2, 1.2)],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 }, indices: 2, material: 0 }] },
      { primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 1 }] },
      { primitives: [{ attributes: { POSITION: 0, COLOR_0: 3 }, indices: 2, material: 2 }] },
    ],
    materials: [
      { name: "Orange", pbrMetallicRoughness: { baseColorFactor: ORANGE, metallicFactor: 0 } },
      { name: "Checker", pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 } },
      { name: "Painted", pbrMetallicRoughness: { metallicFactor: 0 } },
    ],
    textures: [{ source: 0 }],
    images: [{ bufferView: 4, mimeType: "image/png" }],
    buffers: [{ byteLength: chunks.length }],
    bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: "VEC2" },
      { bufferView: 2, componentType: 5123, count: 6, type: "SCALAR" },
      { bufferView: 3, componentType: 5126, count: 4, type: "VEC4" },
    ],
  };
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(text.byteLength / 4) * 4;
  const total = 12 + 8 + jsonLength + 8 + chunks.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(text, 20);
  view.setUint32(20 + jsonLength, chunks.length, true);
  view.setUint32(24 + jsonLength, 0x004e4942, true);
  out.set(chunks, 28 + jsonLength);
  return out;
}
