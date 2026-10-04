import { expect, test } from "bun:test";
import { parseDesignPath, parseDraftAssetPath, parseFilePath } from "./asset-path";

const ID = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
const H = "c".repeat(64);

test("parseDraftAssetPath reads a draft id, a hash and a sandbox file", () => {
  for (const file of ["index.html", "ui.sandbox.js", "ui.css"] as const)
    expect(parseDraftAssetPath(`/c/drafts/${ID}/${H}/${file}`)).toEqual({ draftId: ID, hash: H, file });
});

test("parseDraftAssetPath refuses anything else", () => {
  for (const path of [
    `/c/drafts/not-a-uuid/${H}/index.html`,
    `/c/drafts/${ID.toUpperCase()}/${H}/index.html`,
    `/c/drafts/${ID}/${"g".repeat(64)}/index.html`,
    `/c/drafts/${ID}/${H.toUpperCase()}/index.html`,
    `/c/drafts/${ID}/${"c".repeat(63)}/index.html`,
    `/c/drafts/${ID}/${H}/ui.trusted.js`,
    `/c/drafts/${ID}/${H}/server.js`,
    `/c/drafts/${ID}/${H}/kibo.component.json`,
    `/c/drafts/${ID}/${H}/ui.tsx`,
    `/c/drafts/${ID}/${H}`,
    `/c/drafts/${ID}/${H}/index.html/extra`,
    `/c/drafts/${ID}/${H}/../../x`,
    `/c/drafts/${ID}/..%2F${H}/index.html`,
    `/c/drafts/${ID}.attachments/${H}/index.html`,
    `/c/drafts/${ID}.base/${H}/index.html`,
    `/c/draft/${ID}/${H}/index.html`,
    `/components/drafts/${ID}/${H}/index.html`,
    `c/drafts/${ID}/${H}/index.html`,
    `//c/drafts/${ID}/${H}/index.html`,
  ])
    expect(parseDraftAssetPath(path)).toBeNull();
});

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
