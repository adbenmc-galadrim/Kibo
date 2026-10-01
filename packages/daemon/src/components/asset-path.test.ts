import { expect, test } from "bun:test";
import { parseDraftAssetPath } from "./asset-path";

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
