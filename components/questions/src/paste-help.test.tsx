import { afterEach, expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo, seedQuestions } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { openRow } from "./question-fixtures.test-helper";

afterEach(cleanup);

const answered = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = seedDemo(run);
  seedQuestions(run, [ids["KIB-12"] ?? "", ids["KIB-14"] ?? ""]);
};

test("the paste help says the answer is saved as yours", async () => {
  render(
    <SdkProvider sdk={createMockSdk(manifest, { seed: answered, surface: "view" }).sdk}>
      <Component />
    </SdkProvider>,
  );
  const card = await openRow(/Garder l'ordre/);
  await userEvent.setup().click(within(card).getByRole("button", { name: "Coller la réponse" }));
  expect(within(card).getByText(/^Enregistrée comme ta réponse/).textContent).toBe(
    "Enregistrée comme ta réponse.",
  );
});
