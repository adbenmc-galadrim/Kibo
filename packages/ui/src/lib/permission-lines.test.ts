import { expect, test } from "bun:test";
import { NO_PERMISSIONS } from "@kibo/schema";
import { permissionLines } from "./permission-lines";

const titles = (g: Parameters<typeof permissionLines>[0]) =>
  permissionLines(g).map((l) => [l.title, l.detail ?? null]);

test("screen 30: tickets, own data, no network and no files", () => {
  expect(titles({ ...NO_PERMISSIONS, reads: ["ticket", "status"], data: true })).toEqual([
    ["Lire les tickets du projet", "entités : ticket, status"],
    ["Stocker ses propres données", "espace de nommage de l'instance uniquement"],
    ["Aucun accès réseau, aucun fichier local", null],
  ]);
});

test("writes, notes and network are spelled out", () => {
  expect(
    titles({
      reads: ["note", "page"],
      writes: ["ticket", "note"],
      data: false,
      net: ["api.github.com/graphql"],
      secrets: [],
    }),
  ).toEqual([
    ["Lire les données du projet", "entités : page"],
    ["Lire les notes du projet", null],
    ["Modifier les données du projet", "entités : ticket, note"],
    ["Accéder au réseau", "HTTPS via le démon uniquement : api.github.com/graphql"],
  ]);
  expect(titles({ ...NO_PERMISSIONS, net: ["api.github.com"] }).at(-1)).toEqual([
    "Aucun fichier local",
    null,
  ]);
  expect(titles({ ...NO_PERMISSIONS, reads: ["note"] }).at(-1)).toEqual(["Aucun accès réseau", null]);
});
