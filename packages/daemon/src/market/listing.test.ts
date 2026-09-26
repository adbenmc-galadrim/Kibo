import { expect, test } from "bun:test";
import { generateKeyPair, makeTestIndex, makeTestPackage } from "@kibo/trust/testing";
import { assertListedIn } from "./listing";

const REF = { sourceId: "equipe", id: "burndown", version: "0.1.0" };

async function indexOf(revoked: { hash: string; reason: string }[] = []) {
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0" });
  const source = { id: "equipe", name: "Équipe", keys: await generateKeyPair() };
  const { index } = await makeTestIndex({ source, serial: 1, packages: [{ pkg: made.pkg }], revoked });
  return { made, index };
}

test("a listed version signed by the listed publisher passes", async () => {
  const { made, index } = await indexOf();
  expect(() => assertListedIn(index, REF, made.pkg.hash, made.pkg.publisher.publicKey)).not.toThrow();
});

test("a revoked hash is refused", async () => {
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0" });
  const { index } = await indexOf([{ hash: made.pkg.hash, reason: "clé compromise" }]);
  expect(() => assertListedIn(index, REF, made.pkg.hash, made.pkg.publisher.publicKey)).toThrow("REVOKED");
});

test("a hash no longer listed is refused", async () => {
  const { made, index } = await indexOf();
  expect(() => assertListedIn(index, REF, "c".repeat(64), made.pkg.publisher.publicKey)).toThrow("NOT_FOUND");
});

test("the same hash listed under another publisher key is refused", async () => {
  const { made, index } = await indexOf();
  const other = await generateKeyPair();
  expect(() => assertListedIn(index, REF, made.pkg.hash, other.publicKey)).toThrow("SIGNATURE_INVALID");
});
