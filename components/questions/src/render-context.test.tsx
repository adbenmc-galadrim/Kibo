import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { renderContext } from "./render-context";

const html = (markdown: string): HTMLElement => render(<div>{renderContext(markdown)}</div>).container;

test("paragraphs, lists and inline code are rendered", () => {
  const root = html("Premier paragraphe\nsuite.\n\n- un\n- `deux`\n\n1. premier\n2. second\n\n# Titre");
  expect(Array.from(root.querySelectorAll("p")).map((p) => p.textContent)).toEqual([
    "Premier paragraphe suite.",
    "Titre",
  ]);
  expect(Array.from(root.querySelectorAll("ul > li")).map((li) => li.textContent)).toEqual(["un", "deux"]);
  expect(root.querySelector("ul code")?.textContent).toBe("deux");
  expect(Array.from(root.querySelectorAll("ol > li")).map((li) => li.textContent)).toEqual([
    "premier",
    "second",
  ]);
});

test("raw HTML stays text and never becomes a node", () => {
  const root = html('<script>alert(1)</script> <img src=x onerror="alert(2)"> `<b>`');
  expect(root.querySelector("script")).toBeNull();
  expect(root.querySelector("img")).toBeNull();
  expect(root.querySelector("b")).toBeNull();
  expect(root.textContent).toBe('<script>alert(1)</script> <img src=x onerror="alert(2)"> <b>');
});

test("bold spans are rendered, outside inline code only", () => {
  const root = html("Décision **provisoire** et `**brut**`");
  expect(root.querySelector("p > strong")?.textContent).toBe("provisoire");
  expect(root.querySelector("code")?.textContent).toBe("**brut**");
  expect(html("2 ** 3").querySelector("strong")).toBeNull();
  expect(html("un ` seul").querySelector("code")).toBeNull();
});

test("an empty context renders nothing", () => {
  expect(renderContext("  \n ")).toBeNull();
});
