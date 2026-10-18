import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { ActionToast } from "./ActionToast";

afterEach(cleanup);

test("the toast sits left of the project agent panel and above its layer", () => {
  render(<ActionToast message="F6 débloquée" actionLabel="Voir F6" onAction={() => {}} onClose={() => {}} />);
  const toast = screen.getByRole("status", { name: "F6 débloquée" });
  expect(toast.className).toContain("right-[calc(var(--project-agent-edge,0px)+2.5rem)]");
  expect(toast.className).toContain("z-[60]");
  expect(toast.className).not.toContain("right-10");
});
