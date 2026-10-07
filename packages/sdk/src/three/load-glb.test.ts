import { expect, mock, spyOn, test } from "bun:test";
import {
  BoxGeometry,
  type Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
} from "three";
import { sampleGlb } from "../fixtures-glb";
import { fitCameraTo } from "./fit-camera";
import { coloredGlb, ORANGE } from "./glb-test-kit";
import { loadGlb, parseGlb } from "./load-glb";

test("loadGlb fetches the url and parses the bytes", async () => {
  const urls: string[] = [];
  const fetchFn = async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response(sampleGlb());
  };
  const group = await loadGlb("http://127.0.0.1/f/abc", fetchFn as typeof fetch);
  expect(urls).toEqual(["http://127.0.0.1/f/abc"]);
  expect(group.children.length).toBeGreaterThan(0);
});

test("loadGlb rejects a failed request and parseGlb rejects garbage", async () => {
  const notFound = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
  await expect(loadGlb("http://127.0.0.1/f/none", notFound)).rejects.toThrow("glb request failed: 404");
  await expect(parseGlb(new TextEncoder().encode("not a glb at all").buffer)).rejects.toBeInstanceOf(Error);
});

test("fitCameraTo looks at the center of an offset object", () => {
  const cube = new Mesh(new BoxGeometry());
  cube.position.set(10, 0, 0);
  cube.updateMatrixWorld();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  const target = new Vector3();
  fitCameraTo(cube, camera, target);
  expect(target.toArray()).toEqual([10, 0, 0]);
  const toCenter = target.clone().sub(camera.position).normalize();
  const direction = camera.getWorldDirection(new Vector3());
  expect(direction.distanceTo(toCenter)).toBeLessThan(1e-6);
  expect(camera.near).toBeLessThan(camera.position.distanceTo(target));
  expect(camera.far).toBeGreaterThan(camera.position.distanceTo(target));
});

test("parseGlb computes normals for a mesh that has none", async () => {
  const group = await parseGlb(sampleGlb({ normals: false }).slice().buffer);
  const cube = group.getObjectByName("Cube");
  expect(cube instanceof Mesh && cube.geometry.getAttribute("normal").count).toBe(8);
});

async function withCreateImageBitmap(value: unknown, run: () => Promise<void>): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  if (value === undefined) Reflect.deleteProperty(globalThis, "createImageBitmap");
  else Reflect.set(globalThis, "createImageBitmap", value);
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(globalThis, "createImageBitmap", original);
    else Reflect.deleteProperty(globalThis, "createImageBitmap");
  }
}

const meshMaterial = (group: Group, name: string) => {
  const mesh = group.getObjectByName(name);
  if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshStandardMaterial)) throw new Error(name);
  return { mesh, material: mesh.material };
};

test("without createImageBitmap a model without image still loads", () =>
  withCreateImageBitmap(undefined, async () => {
    const group = await parseGlb(sampleGlb().slice().buffer);
    expect(group.getObjectByName("Cube")).toBeInstanceOf(Mesh);
  }));

test("a texture that fails to decode leaves the model loaded without its map", () =>
  withCreateImageBitmap(
    mock(async (_: Blob) => {
      throw new Error("decoder down");
    }),
    async () => {
      const logged = spyOn(console, "error").mockImplementation(() => {});
      try {
        const group = await parseGlb(coloredGlb().slice().buffer);
        expect(meshMaterial(group, "Textured").material.map).toBeNull();
        expect(meshMaterial(group, "Flat").material.map).toBeNull();
        expect(logged).toHaveBeenCalled();
      } finally {
        logged.mockRestore();
      }
    },
  ));

test("parseGlb keeps the colors of a model: factor, embedded texture and vertex colors", async () => {
  const bitmap = { width: 4, height: 4, close() {} };
  const decode = mock(async (_: Blob) => bitmap);
  const objectUrl = spyOn(URL, "createObjectURL");
  try {
    await withCreateImageBitmap(decode, async () => {
      const group = await parseGlb(coloredGlb().slice().buffer);
      const flat = meshMaterial(group, "Flat").material;
      expect(flat.color.toArray()).toEqual(
        [ORANGE[0], ORANGE[1], ORANGE[2]].map((v) => expect.closeTo(v, 5)),
      );
      expect(flat.map).toBeNull();
      const textured = meshMaterial(group, "Textured").material;
      expect(textured.map?.image).toBe(bitmap);
      expect(textured.map?.colorSpace).toBe(SRGBColorSpace);
      expect(textured.map?.flipY).toBe(false);
      expect(textured.color.getHex()).toBe(0xffffff);
      const painted = meshMaterial(group, "Painted");
      expect(painted.material.vertexColors).toBe(true);
      expect(painted.mesh.geometry.getAttribute("color").count).toBe(4);
      expect(decode).toHaveBeenCalledTimes(1);
      expect(decode.mock.calls[0]?.[0].type).toBe("image/png");
      expect(objectUrl).not.toHaveBeenCalled();
    });
  } finally {
    objectUrl.mockRestore();
  }
});
