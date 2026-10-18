import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

test("the sheet close button reads Fermer", () => {
  render(
    <Sheet open>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>SILO-45</SheetTitle>
      </SheetContent>
    </Sheet>,
  );
  expect(screen.getByRole("button", { name: "Fermer" })).toBeDefined();
});
