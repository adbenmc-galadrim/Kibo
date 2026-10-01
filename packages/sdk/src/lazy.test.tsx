import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { LAZY_FALLBACK_SELECTOR, lazyPanel } from "./lazy";

const labels = { loading: "Chargement…", failed: "Impossible de charger cet écran.", retry: "Réessayer" };
const Hello = ({ name }: { name: string }) => <p>Bonjour {name}</p>;

function silenced<T>(run: (errors: unknown[]) => Promise<T>): Promise<T> {
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args[0]);
  };
  return run(errors).finally(() => {
    console.error = original;
  });
}

class Outer extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? <p>outer: {this.state.error}</p> : this.props.children;
  }
}

describe("lazyPanel", () => {
  test("shows the fallback, then the loaded component with its props", async () => {
    let resolve: (c: typeof Hello) => void = () => {};
    const Panel = lazyPanel(
      () =>
        new Promise<typeof Hello>((r) => {
          resolve = r;
        }),
      labels,
    );
    const { container } = render(<Panel name="Adam" />);
    expect(screen.getByRole("status").textContent).toBe("Chargement…");
    expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).not.toBeNull();
    await act(async () => resolve(Hello));
    expect(await screen.findByText("Bonjour Adam")).toBeTruthy();
    expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).toBeNull();
  });

  test("a failed load shows an alert, logs the cause, and retry loads again", () =>
    silenced(async (errors) => {
      let calls = 0;
      const Panel = lazyPanel(async () => {
        calls += 1;
        if (calls === 1) throw new Error("chunk missing");
        return Hello;
      }, labels);
      render(<Panel name="Adam" />);
      expect((await screen.findByRole("alert")).textContent).toContain("Impossible de charger cet écran.");
      expect(errors.some((e) => e instanceof Error && e.message === "chunk missing")).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
      expect(await screen.findByText("Bonjour Adam")).toBeTruthy();
      expect(calls).toBe(2);
    }));

  test("a render error of the loaded module reaches the parent boundary", () =>
    silenced(async () => {
      const Broken = (): ReactNode => {
        throw new Error("boom");
      };
      const Panel = lazyPanel(async () => Broken, labels);
      render(
        <Outer>
          <Panel />
        </Outer>,
      );
      expect(await screen.findByText("outer: boom")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    }));

  test("the sr-only fallback stays out of the layout", () => {
    const Panel = lazyPanel(() => new Promise<typeof Hello>(() => {}), labels, { fallback: "sr-only" });
    render(<Panel name="Adam" />);
    expect(screen.getByRole("status").className).toContain("sr-only");
  });

  test('fallback "children" keeps the wrapped element visible while loading', async () => {
    let resolve: (c: typeof Wrapper) => void = () => {};
    const Wrapper = ({ children }: { children: ReactNode }) => <div data-wrapped>{children}</div>;
    const Panel = lazyPanel<{ children: ReactNode }>(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
      labels,
      { fallback: "children" },
    );
    const { container } = render(
      <Panel>
        <button type="button">Kibo</button>
      </Panel>,
    );
    expect(screen.getByRole("button", { name: "Kibo" })).toBeTruthy();
    expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).toBeNull();
    await act(async () => resolve(Wrapper));
    expect(container.querySelector("[data-wrapped]")?.textContent).toBe("Kibo");
  });
});
