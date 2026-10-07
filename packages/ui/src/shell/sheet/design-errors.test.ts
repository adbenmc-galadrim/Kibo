import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { frameErrorText, linkErrorText } from "./design-errors";
import type { DesignRef } from "./design-refs";

const FILE = "33333333-3333-4333-8333-333333333333";
const PAGE = "44444444-4444-4444-8444-444444444444";
const BOARD = "55555555-5555-4555-8555-555555555555";
const penpot: DesignRef = {
  kind: "penpot_board",
  instance: "http://localhost:9010",
  fileId: FILE,
  pageId: PAGE,
  boardId: BOARD,
  url: `http://localhost:9010/#/view/${FILE}?page-id=${PAGE}&board-id=${BOARD}`,
  name: "Accueil",
};
const figma: DesignRef = {
  kind: "figma_node",
  fileKey: "AbC123xyz",
  nodeId: "12:34",
  url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34",
  name: "Tickets",
};

test("frame errors name their cause and provider", () => {
  expect(frameErrorText(new KiboError("REMOTE_NOT_RENDERED", "x"), penpot)).toBe(
    "Pas encore d'aperçu : ouvre ce fichier dans Penpot pour le générer, puis actualise.",
  );
  expect(frameErrorText(new KiboError("REMOTE_REJECTED", "x"), penpot)).toBe(
    "Penpot a refusé le jeton. Reconnecte Penpot dans Paramètres › Intégrations.",
  );
  expect(frameErrorText(new KiboError("INVALID_INPUT", "x"), penpot)).toBe(
    "Ce board est sur une autre instance Penpot (localhost:9010) que celle connectée.",
  );
  expect(frameErrorText(new KiboError("REMOTE_NOT_FOUND", "x"), penpot)).toBe(
    "Board introuvable : supprimé, ou le lien vise un autre fichier.",
  );
  expect(frameErrorText(new KiboError("REMOTE_NOT_FOUND", "x"), figma)).toBe(
    "Cadre introuvable : supprimé, ou ton compte n'y a pas accès.",
  );
  expect(frameErrorText(new KiboError("TIMEOUT", "x"), figma)).toBe(
    "Figma ne répond pas. Vérifie ta connexion, ou que l'instance est démarrée.",
  );
  expect(frameErrorText(new KiboError("INTERNAL", "x"), figma)).toBe("Maquette indisponible (INTERNAL).");
  expect(frameErrorText(new Error("boom"), figma)).toBe("Maquette indisponible.");
});

test("link errors explain the url or the instance", () => {
  const boardless = `https://design.penpot.app/#/workspace?team-id=1&file-id=${FILE}&page-id=${PAGE}`;
  expect(linkErrorText(new KiboError("INVALID_INPUT", "x"), boardless)).toBe(
    "Sélectionne un board dans Penpot avant de copier l'adresse : il manque board-id.",
  );
  expect(linkErrorText(new KiboError("INVALID_INPUT", "x"), penpot.url)).toBe(
    "Ce board est sur une autre instance Penpot (localhost:9010) que celle connectée.",
  );
  expect(linkErrorText(new KiboError("NOT_CONNECTED", "x"), figma.url)).toBe(
    "Connecte Figma dans Paramètres › Intégrations.",
  );
  expect(linkErrorText(new KiboError("NOT_CONNECTED", "x"), penpot.url)).toBe(
    "Connecte Penpot dans Paramètres › Intégrations.",
  );
});
