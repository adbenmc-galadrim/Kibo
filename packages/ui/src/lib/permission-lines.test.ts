import { expect, test } from "bun:test";
import { NO_PERMISSIONS } from "@kibo/schema";
import { permissionLabel, permissionLines } from "./permission-lines";

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
      mcp: [],
      capabilities: [],
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

test("secrets and mcp rules read in plain French", () => {
  expect(
    titles({
      ...NO_PERMISSIONS,
      net: ["api.github.com"],
      secrets: [{ name: "github", hosts: ["api.github.com"] }],
      mcp: ["context7", "context7/get-library-docs"],
    }).slice(1),
  ).toEqual([
    ["Utiliser ton compte GitHub (api.github.com)", null],
    ["Appeler le serveur MCP context7", null],
    ["Appeler l'outil get-library-docs du serveur MCP context7", null],
  ]);
});

test("rules a third-party component can never use are not shown", () => {
  expect(titles({ ...NO_PERMISSIONS, mcp: ["{config.server}", "figma", "figma/get_code", "ctx"] })).toEqual([
    ["Appeler le serveur MCP ctx", null],
  ]);
});

test("an mcp server may reach the network and local files, so no closing promise is made", () => {
  expect(titles({ ...NO_PERMISSIONS, mcp: ["ctx"] })).toEqual([["Appeler le serveur MCP ctx", null]]);
  expect(titles({ ...NO_PERMISSIONS, reads: ["note"], mcp: ["ctx"] }).at(-1)).toEqual([
    "Appeler le serveur MCP ctx",
    null,
  ]);
  expect(titles({ ...NO_PERMISSIONS, net: ["api.github.com"], mcp: ["{config.server}"] })).toEqual([
    ["Accéder au réseau", "HTTPS via le démon uniquement : api.github.com"],
  ]);
});

test("ci runs are named in French", () => {
  expect(titles({ ...NO_PERMISSIONS, reads: ["ticket", "ci_run"] })[0]).toEqual([
    "Lire les tickets du projet",
    "entités : ticket, runs CI",
  ]);
  expect(titles({ ...NO_PERMISSIONS, reads: ["ci_run"] })[0]).toEqual([
    "Lire les données du projet",
    "entités : runs CI",
  ]);
});

test("each secret lists every host it is sent to", () => {
  expect(
    titles({
      ...NO_PERMISSIONS,
      net: ["api.github.com", "uploads.github.com", "api.linear.app"],
      secrets: [
        { name: "github", hosts: ["api.github.com", "uploads.github.com"] },
        { name: "mcp:linear:API_KEY", hosts: ["api.linear.app"] },
      ],
    }).slice(1, 3),
  ).toEqual([
    ["Utiliser ton compte GitHub (api.github.com, uploads.github.com)", null],
    ["Utiliser le secret mcp:linear:API_KEY (api.linear.app)", null],
  ]);
});

test("new permission entries of a version read in plain French", () => {
  expect(permissionLabel("secret:github@api.github.com")).toBe("Utiliser ton compte GitHub (api.github.com)");
  expect(permissionLabel("secret:mcp:linear:API_KEY@api.linear.app")).toBe(
    "Utiliser le secret mcp:linear:API_KEY (api.linear.app)",
  );
  expect(permissionLabel("mcp:ctx")).toBe("Appeler le serveur MCP ctx");
  expect(permissionLabel("mcp:ctx/echo")).toBe("Appeler l'outil echo du serveur MCP ctx");
  expect(permissionLabel("mcp:{config.server}")).toBe("Appeler le serveur MCP choisi à l'ajout");
  expect(permissionLabel("net:api.github.com/graphql")).toBe("Permission net:api.github.com/graphql");
  expect(permissionLabel("secret:broken")).toBe("Permission secret:broken");
  expect(permissionLabel("secret:github@")).toBe("Permission secret:github@");
});

test("capabilities and selection get plain-language lines", () => {
  const g = {
    ...NO_PERMISSIONS,
    capabilities: ["webgl", "assets", "fullscreen", "gamepad", "audio"] as const,
  };
  expect(titles({ ...g, capabilities: [...g.capabilities] })).toEqual([
    ["Afficher de la 3D (WebGL)", "utilise la carte graphique"],
    ["Jouer du son", null],
    ["Passer en plein écran dans Kibo", null],
    ["Lire les manettes branchées", null],
    ["Lire les fichiers du projet", "dossier des fichiers de ce projet, lecture seule"],
    ["Aucun accès réseau", null],
  ]);
  expect(titles({ ...NO_PERMISSIONS, net: ["api.github.com"], capabilities: ["assets"] })).toEqual([
    ["Accéder au réseau", "HTTPS via le démon uniquement : api.github.com"],
    ["Lire les fichiers du projet", "dossier des fichiers de ce projet, lecture seule"],
  ]);
  expect(titles({ ...NO_PERMISSIONS, capabilities: ["gamepad"] }).at(-1)).toEqual([
    "Aucun accès réseau, aucun fichier local",
    null,
  ]);
  expect(permissionLines(NO_PERMISSIONS).map((l) => l.title)).toEqual([
    "Aucun accès réseau, aucun fichier local",
  ]);
  expect(permissionLines(NO_PERMISSIONS, { selection: true }).map((l) => l.title)).toEqual([
    "Partage la sélection avec les composants de la page",
    "Aucun accès réseau, aucun fichier local",
  ]);
  expect(permissionLabel("cap:webgl")).toBe("Afficher de la 3D (WebGL)");
  expect(permissionLabel("cap:assets")).toBe("Lire les fichiers du projet");
  expect(permissionLabel("cap:unknown")).toBe("Permission cap:unknown");
});
