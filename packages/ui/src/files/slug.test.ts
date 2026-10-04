import { expect, test } from "bun:test";
import { slugName } from "./slug";

test("an original name is lowered, stripped of accents and dashed", () => {
  expect(slugName("Robot Final V2.GLB")).toBe("robot-final-v2.glb");
  expect(slugName("éléphant.PNG")).toBe("elephant.png");
  expect(slugName("Cube Demo.glb")).toBe("cube-demo.glb");
});

test("a leading dot or symbol is dropped, an empty base becomes fichier", () => {
  expect(slugName(".hidden.png")).toBe("hidden.png");
  expect(slugName("__.wav")).toBe("fichier.wav");
});

test("an unsupported or missing extension gives null", () => {
  expect(slugName("scene.gltf")).toBeNull();
  expect(slugName("README")).toBeNull();
  expect(slugName("archive.zip")).toBeNull();
});

test("a very long name is cut to a valid project file name", () => {
  const name = slugName(`${"a".repeat(300)}.ogg`);
  expect(name).toBe(`${"a".repeat(100)}.ogg`);
});
