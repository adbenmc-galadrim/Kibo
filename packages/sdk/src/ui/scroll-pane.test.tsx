import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { ScrollPane } from "./scroll-pane";

test("ScrollPane scrolls on its own inside a bounded flex or grid parent", () => {
  render(
    <ScrollPane aria-label="Volet" className="w-64 border-l">
      <p>contenu</p>
    </ScrollPane>,
  );
  const pane = screen.getByLabelText("Volet");
  expect(pane.getAttribute("data-slot")).toBe("scroll-pane");
  expect(pane.className.split(" ")).toEqual(
    expect.arrayContaining(["min-h-0", "overflow-y-auto", "overflow-x-hidden", "scrollbar-thin", "w-64", "border-l"]),
  );
  expect(screen.getByText("contenu").parentElement).toBe(pane);
});

test("ScrollPane renders the element it is asked for", () => {
  render(<ScrollPane as="aside" aria-label="Liens" />);
  expect(screen.getByRole("complementary", { name: "Liens" }).getAttribute("data-slot")).toBe("scroll-pane");
});

test("ScrollPane hands its element to a ref, to follow the bottom of a feed", () => {
  const ref = createRef<HTMLElement>();
  render(<ScrollPane ref={ref} aria-label="Fil" />);
  expect(ref.current).toBe(screen.getByLabelText("Fil"));
});
