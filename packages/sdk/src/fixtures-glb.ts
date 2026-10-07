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

type Face = { normal: number[]; corners: [number, number, number, number] };

const FACES: Face[] = [
  { normal: [0, 1, 0], corners: [7, 6, 2, 3] },
  { normal: [0, -1, 0], corners: [0, 1, 5, 4] },
  { normal: [1, 0, 0], corners: [5, 1, 2, 6] },
  { normal: [-1, 0, 0], corners: [0, 4, 7, 3] },
  { normal: [0, 0, 1], corners: [4, 5, 6, 7] },
  { normal: [0, 0, -1], corners: [1, 0, 3, 2] },
];

const quad = ([a, b, c, d]: [number, number, number, number]) => [a, b, c, a, c, d];

const padded = (length: number) => Math.ceil(length / 4) * 4;

type CubeBuffers = {
  bytes: Uint8Array;
  views: { buffer: number; byteOffset: number; byteLength: number; target: number }[];
  accessors: Record<string, unknown>[];
  attributes: Record<string, number>;
};

function cubeArrays(normals: boolean): {
  positions: Float32Array;
  indices: Uint16Array;
  normals?: Float32Array;
} {
  if (!normals) {
    return {
      positions: new Float32Array(CORNERS.flat()),
      indices: new Uint16Array(FACES.flatMap((f) => quad(f.corners))),
    };
  }
  return {
    positions: new Float32Array(FACES.flatMap((f) => f.corners.flatMap((c) => CORNERS[c] ?? []))),
    indices: new Uint16Array(FACES.flatMap((_, i) => quad([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3]))),
    normals: new Float32Array(FACES.flatMap((f) => [f.normal, f.normal, f.normal, f.normal].flat())),
  };
}

function cubeBuffers(withNormals: boolean): CubeBuffers {
  const { positions, indices, normals } = cubeArrays(withNormals);
  const parts: { data: Float32Array | Uint16Array; target: number }[] = [
    { data: positions, target: ARRAY_BUFFER },
    { data: indices, target: ELEMENT_ARRAY_BUFFER },
    ...(normals ? [{ data: normals, target: ARRAY_BUFFER }] : []),
  ];
  const bytes = new Uint8Array(padded(parts.reduce((n, p) => n + p.data.byteLength, 0)));
  let offset = 0;
  const views = parts.map((p) => {
    bytes.set(new Uint8Array(p.data.buffer), offset);
    const view = { buffer: 0, byteOffset: offset, byteLength: p.data.byteLength, target: p.target };
    offset += p.data.byteLength;
    return view;
  });
  const vertexCount = positions.length / 3;
  const accessors: Record<string, unknown>[] = [
    {
      bufferView: 0,
      componentType: FLOAT,
      count: vertexCount,
      type: "VEC3",
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    },
    { bufferView: 1, componentType: UNSIGNED_SHORT, count: indices.length, type: "SCALAR" },
    ...(normals ? [{ bufferView: 2, componentType: FLOAT, count: vertexCount, type: "VEC3" }] : []),
  ];
  return { bytes, views, accessors, attributes: normals ? { POSITION: 0, NORMAL: 2 } : { POSITION: 0 } };
}

function gltfJson(cube: CubeBuffers) {
  return {
    asset: { version: "2.0", generator: "kibo-fixtures" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "Cube" }],
    meshes: [{ name: "Cube", primitives: [{ attributes: cube.attributes, indices: 1, material: 0 }] }],
    materials: [
      { name: "Kibo", pbrMetallicRoughness: { baseColorFactor: [0.98, 0.45, 0.09, 1], metallicFactor: 0 } },
    ],
    buffers: [{ byteLength: cube.bytes.byteLength }],
    bufferViews: cube.views,
    accessors: cube.accessors,
  };
}

function jsonChunk(value: unknown): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(value));
  const bytes = new Uint8Array(padded(text.byteLength)).fill(0x20);
  bytes.set(text, 0);
  return bytes;
}

export function sampleGlb(options: { normals?: boolean } = {}): Uint8Array<ArrayBuffer> {
  const cube = cubeBuffers(options.normals !== false);
  const json = jsonChunk(gltfJson(cube));
  const total = 12 + 8 + json.byteLength + 8 + cube.bytes.byteLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, json.byteLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.set(json, 20);
  const binStart = 20 + json.byteLength;
  view.setUint32(binStart, cube.bytes.byteLength, true);
  view.setUint32(binStart + 4, BIN_CHUNK, true);
  out.set(cube.bytes, binStart + 8);
  return out;
}
