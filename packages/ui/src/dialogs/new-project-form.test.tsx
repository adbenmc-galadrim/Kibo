import { afterEach, expect, test } from "bun:test";
import { Dialog, DialogContent, DialogTitle } from "@kibo/sdk/ui/dialog";
import { cleanup, render, screen } from "@testing-library/react";
import { NewProjectForm } from "./NewProjectForm";
import { defaultFields, validate } from "./new-project-model";

afterEach(cleanup);

test("the create button is not the agent variant", () => {
  const fields = defaultFields("2026-10-16");
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Nouveau projet</DialogTitle>
        <NewProjectForm
          fields={fields}
          onFields={() => {}}
          validation={validate(fields, [])}
          busy={false}
          error={null}
          focusFolder={false}
          onCancel={() => {}}
          onSubmit={() => {}}
        />
      </DialogContent>
    </Dialog>,
  );
  expect(screen.getByRole("button", { name: "Créer" }).dataset.variant).toBe("default");
});
