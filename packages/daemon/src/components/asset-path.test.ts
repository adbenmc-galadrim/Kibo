import { expect, test } from "bun:test";
import { parseDesignPath, parseEmbedPath, parseFilePath } from "./asset-path";

test("parseFilePath reads a token and a project file name", () => {
  const token = "a".repeat(64);
  expect(parseFilePath(`/f/${token}/robot.glb`)).toEqual({ token, name: "robot.glb" });
});

test("parseFilePath refuses anything else", () => {
  const token = "a".repeat(64);
  for (const path of [
    `/f/${token}/Robot.glb`,
    `/f/${"a".repeat(63)}/a.glb`,
    `/f/${token.toUpperCase()}/a.glb`,
    `/f/${token}/a.glb/b`,
    `/f/${token}`,
    `/f/${token}/`,
    `/f/${token}/a.gltf`,
    `/f/${token}/..%2Fa.glb`,
    `/f/${token}/.a.glb`,
    `/c/${token}/a.glb`,
    `//f/${token}/a.glb`,
    "/f/short/robot.glb",
  ])
    expect(parseFilePath(path)).toBeNull();
});

test("parseDesignPath reads a token and a frame name", () => {
  const token = "a".repeat(64);
  for (const name of ["frame.png", "frame.webp", "frame.jpg"])
    expect(parseDesignPath(`/d/${token}/${name}`)).toEqual({ token, name });
});

test("parseDesignPath refuses anything else", () => {
  const token = "a".repeat(64);
  for (const path of [
    `/d/${token}/frame.svg`,
    `/d/${token}/frame.jpeg`,
    `/d/${token}/robot.png`,
    `/d/${token}/Frame.png`,
    `/d/${"a".repeat(63)}/frame.png`,
    `/d/${token.toUpperCase()}/frame.png`,
    `/d/${token}`,
    `/d/${token}/`,
    `/d/${token}/frame.png/x`,
    `/f/${token}/frame.png`,
    `//d/${token}/frame.png`,
  ])
    expect(parseDesignPath(path)).toBeNull();
});

test("parseEmbedPath reads a relay token and nothing else", () => {
  const token = "a".repeat(64);
  expect(parseEmbedPath(`/e/${token}`)).toEqual({ token });
  for (const path of [
    `/e/${"A".repeat(64)}`,
    `/e/${"a".repeat(63)}`,
    `/e/${"a".repeat(65)}`,
    `/e/${token}/`,
    `/e/${token}/frame.html`,
    `/f/${token}`,
    `/e//${token}`,
    "/e/",
    "/e",
  ])
    expect(parseEmbedPath(path)).toBeNull();
});
