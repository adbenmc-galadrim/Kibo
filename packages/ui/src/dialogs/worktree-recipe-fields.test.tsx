import { expect, mock, test } from "bun:test";
import type { WorktreeRecipe } from "@kibo/schema";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { WorktreeRecipeFields } from "./WorktreeRecipeFields";

const EMIS: WorktreeRecipe = {
  copyFrom: ["{sibling}", "{repo}"],
  copy: [".env", "apps/web/.env.local"],
  env: {
    file: ".env",
    ports: { keys: { WEB_PORT: 3000, SERVER_PORT: 4000 }, from: 1, step: 10, count: 50 },
    replace: { DATABASE_URL: ["emis_\\w+", "emis_{short_}"] },
    set: { APP_NAME: "emis-{short}" },
  },
  after: ["pnpm install"],
};

const draw = (value: WorktreeRecipe | null = EMIS) => {
  const changes: (WorktreeRecipe | null)[] = [];
  const problems = mock((_: string | null) => {});
  render(
    <WorktreeRecipeFields
      value={value}
      onChange={(next) => changes.push(next)}
      onProblem={problems}
      disabled={false}
    />,
  );
  const box = within(screen.getByRole("group", { name: "Recette" }));
  const field = (name: string) => box.getByRole("textbox", { name }) as HTMLInputElement;
  const number = (name: string) => box.getByRole("spinbutton", { name }) as HTMLInputElement;
  return { changes, problems, box, field, number };
};

test("screen 215c: the recipe shows files, sources, env file, ports by key and after commands", () => {
  const { box, field, number } = draw();
  expect(field("Fichiers à copier").value).toBe(".env\napps/web/.env.local");
  expect(field("Sources").value).toBe("{sibling}\n{repo}");
  expect(field("Fichier d'environnement").value).toBe(".env");
  expect(field("Ports").value).toBe("WEB_PORT=3000\nSERVER_PORT=4000");
  expect([number("Premier jeu").value, number("Pas").value, number("Jeux au plus").value]).toEqual([
    "1",
    "10",
    "50",
  ]);
  expect(field("Commandes après").value).toBe("pnpm install");
  expect(box.getByText("jouée après la création, jamais sur un worktree adopté")).toBeTruthy();
});

test("editing a field keeps the replacements and assignments of the env file", () => {
  const { changes, field } = draw();
  fireEvent.change(field("Ports"), { target: { value: "WEB_PORT=3100\nSERVER_PORT=4100\nDB_PORT=5432" } });
  expect(changes.at(-1)).toEqual({
    ...EMIS,
    env: {
      ...EMIS.env,
      file: ".env",
      ports: { keys: { WEB_PORT: 3100, SERVER_PORT: 4100, DB_PORT: 5432 }, from: 1, step: 10, count: 50 },
      replace: EMIS.env?.replace ?? {},
      set: EMIS.env?.set ?? {},
    },
  });
});

test("a file that climbs out of the worktree is refused and not sent", () => {
  const { changes, problems, box, field } = draw();
  fireEvent.change(field("Fichiers à copier"), { target: { value: ".env\n../secrets/.env" } });
  const message = "Les fichiers à copier sont des chemins relatifs, sans .. (32 au plus).";
  expect(box.getByText(message)).toBeTruthy();
  expect(problems).toHaveBeenLastCalledWith(message);
  expect(changes).toEqual([]);
});

test("a malformed port line or a reserved key is refused", () => {
  const { changes, box, field } = draw();
  fireEvent.change(field("Ports"), { target: { value: "WEB_PORT 3000" } });
  const message =
    "Ports : une ligne CLÉ=base par port (8 au plus), clé en majuscules, hors variables réservées.";
  expect(box.getByText(message)).toBeTruthy();
  fireEvent.change(field("Ports"), { target: { value: "PATH=3000" } });
  expect(box.getByText(message)).toBeTruthy();
  expect(changes).toEqual([]);
});

test("an empty recipe is null, a first file starts one", () => {
  const { changes, field, number } = draw(null);
  expect(field("Fichiers à copier").value).toBe("");
  expect(number("Pas").value).toBe("10");
  fireEvent.change(field("Fichiers à copier"), { target: { value: ".env" } });
  expect(changes.at(-1)).toEqual({ copyFrom: [], copy: [".env"], env: null, after: [] });
  fireEvent.change(field("Fichiers à copier"), { target: { value: "" } });
  expect(changes.at(-1)).toBeNull();
});
