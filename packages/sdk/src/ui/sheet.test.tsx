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

test("the open animation lasts 250 ms with the ease-out curve and 0 under reduced motion", () => {
  render(
    <Sheet open>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>SILO-45</SheetTitle>
      </SheetContent>
    </Sheet>,
  );
  const classes = screen.getByRole("dialog").className.split(" ");
  expect(classes).toContain("data-[state=open]:duration-[250ms]");
  expect(classes).toContain("data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)]");
  expect(classes).toContain("data-[state=closed]:duration-200");
  expect(classes).toContain("motion-reduce:data-[state=open]:duration-0");
  expect(classes).toContain("motion-reduce:data-[state=closed]:duration-0");
  expect(classes).not.toContain("data-[state=open]:duration-500");
});
