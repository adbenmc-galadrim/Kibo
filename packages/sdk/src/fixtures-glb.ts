const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const CORNERS = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

const FACES = [
  [4, 5, 6, 4, 6, 7],
  [1, 0, 3, 1, 3, 2],
  [5, 1, 2, 5, 2, 6],
  [0, 4, 7, 0, 7, 3],
  [7, 6, 2, 7, 2, 3],
  [0, 1, 5, 0, 5, 4],
];

const padded = (length: number) => Math.ceil(length / 4) * 4;

function binaryChunk(): { bytes: Uint8Array; positionsLength: number; indicesLength: number } {
  const positions = new Float32Array(CORNERS.flat());
  const indices = new Uint16Array(FACES.flat());
  const positionsLength = positions.byteLength;
  const indicesLength = indices.byteLength;
  const bytes = new Uint8Array(padded(positionsLength + indicesLength));
  bytes.set(new Uint8Array(positions.buffer), 0);
  bytes.set(new Uint8Array(indices.buffer), positionsLength);
  return { bytes, positionsLength, indicesLength };
}

function gltfJson(binLength: number, positionsLength: number, indicesLength: number) {
  return {
    asset: { version: "2.0", generator: "kibo-fixtures" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "Cube" }],
    meshes: [{ name: "Cube", primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [
      { name: "Kibo", pbrMetallicRoughness: { baseColorFactor: [0.98, 0.45, 0.09, 1], metallicFactor: 0 } },
    ],
    buffers: [{ byteLength: binLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionsLength, target: ARRAY_BUFFER },
      { buffer: 0, byteOffset: positionsLength, byteLength: indicesLength, target: ELEMENT_ARRAY_BUFFER },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: FLOAT,
        count: CORNERS.length,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      { bufferView: 1, componentType: UNSIGNED_SHORT, count: FACES.flat().length, type: "SCALAR" },
    ],
  };
}

function jsonChunk(value: unknown): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(value));
  const bytes = new Uint8Array(padded(text.byteLength)).fill(0x20);
  bytes.set(text, 0);
  return bytes;
}

export function sampleGlb(): Uint8Array<ArrayBuffer> {
  const bin = binaryChunk();
  const json = jsonChunk(gltfJson(bin.bytes.byteLength, bin.positionsLength, bin.indicesLength));
  const total = 12 + 8 + json.byteLength + 8 + bin.bytes.byteLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, json.byteLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.set(json, 20);
  const binStart = 20 + json.byteLength;
  view.setUint32(binStart, bin.bytes.byteLength, true);
  view.setUint32(binStart + 4, BIN_CHUNK, true);
  out.set(bin.bytes, binStart + 8);
  return out;
}
