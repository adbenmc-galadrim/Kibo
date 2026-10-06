import { expect, test } from "bun:test";
import { BoxGeometry, Mesh, PerspectiveCamera, Vector3 } from "three";
import { sampleGlb } from "../fixtures-glb";
import { fitCameraTo } from "./fit-camera";
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
