import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageBoundary } from "./PageBoundary";

afterEach(cleanup);

const quiet = async (run: () => Promise<void>) => {
  const original = console.error;
  console.error = () => undefined;
  try {
    await run();
  } finally {
    console.error = original;
  }
};

let broken = false;
function Flaky() {
  if (broken) throw new Error("render failed");
  return <p>Kanban chargé</p>;
}

test("a page that throws shows the error notice, the shell around it stays", async () => {
  await quiet(async () => {
    broken = true;
    render(
      <main>
        <h1>Coque</h1>
        <PageBoundary resetKey="a">
          <Flaky />
        </PageBoundary>
      </main>,
    );
    expect(await screen.findByText("Cette page a rencontré une erreur")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Coque" })).toBeTruthy();
  });
});

test("Réessayer mounts the page again", async () => {
  await quiet(async () => {
    broken = true;
    render(
      <PageBoundary resetKey="a">
        <Flaky />
      </PageBoundary>,
    );
    const retry = await screen.findByRole("button", { name: "Réessayer" });
    broken = false;
    await userEvent.setup().click(retry);
    expect(screen.getByText("Kanban chargé")).toBeTruthy();
  });
});

test("opening another page clears the error", async () => {
  await quiet(async () => {
    broken = true;
    const view = render(
      <PageBoundary resetKey="a">
        <Flaky />
      </PageBoundary>,
    );
    await screen.findByText("Cette page a rencontré une erreur");
    broken = false;
    view.rerender(
      <PageBoundary resetKey="b">
        <Flaky />
      </PageBoundary>,
    );
    expect(screen.getByText("Kanban chargé")).toBeTruthy();
  });
});
