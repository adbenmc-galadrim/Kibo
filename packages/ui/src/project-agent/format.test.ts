import { expect, test } from "bun:test";
import { errorText } from "./format";

test("errors are said in French", () => {
  expect(errorText("WORKSPACE_FAILED: setup command exited with 127:\nsh: pnpm: command not found")).toBe(
    "espace de travail indisponible (setup command exited with 127:\nsh: pnpm: command not found)",
  );
  expect(errorText("PROJECT_FOLDER_MISSING: the project has no local folder")).toBe(
    "projet sans dossier local",
  );
  expect(errorText("PROJECT_FOLDER_NOT_FOUND: folder /x does not exist")).toBe(
    "dossier du projet introuvable",
  );
  expect(errorText("NOT_A_REPO: /x is not a git repository")).toBe(
    "le dossier du projet n'est pas un dépôt git",
  );
  expect(errorText("GIT_FAILED: base branch feat/x not found locally or on origin")).toBe(
    "git n'a pas pu préparer l'espace de travail (base branch feat/x not found locally or on origin)",
  );
  expect(errorText("exit code 1")).toBe("exit code 1");
});
