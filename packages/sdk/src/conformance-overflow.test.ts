import { expect, test } from "bun:test";
import { type BoxNode, collectBoxes, overflowViolations } from "./conformance-overflow";

const box = (path: string, rect: [number, number, number, number], opts: Partial<BoxNode> = {}): BoxNode => ({
  path,
  rect: { left: rect[0], top: rect[1], right: rect[2], bottom: rect[3] },
  clips: false,
  painted: false,
  children: [],
  ...opts,
});

test("a painted element that does not clip must contain every descendant box", () => {
  const column = box("section", [0, 0, 200, 400], { painted: true });
  column.children = [box("section>header", [0, 0, 200, 28]), box("section>div", [0, 28, 200, 640])];
  expect(overflowViolations(column)).toEqual([{ container: "section", child: "section>div", by: 240 }]);
});

test("a clipping descendant stops the walk, and one pixel is tolerated", () => {
  const column = box("section", [0, 0, 200, 400], { painted: true });
  const cards = box("section>div", [0, 28, 200, 401], { clips: true });
  cards.children = [box("section>div>article", [0, 28, 200, 900])];
  column.children = [cards];
  expect(overflowViolations(column)).toEqual([]);
});

test("unpainted or clipping containers are never judged, zero-size children are ignored", () => {
  const plain = box("div", [0, 0, 10, 10]);
  plain.children = [box("div>p", [0, 0, 500, 500])];
  const clipping = box("main", [0, 0, 10, 10], { painted: true, clips: true });
  clipping.children = [box("main>p", [0, 0, 500, 500])];
  const painted = box("aside", [0, 0, 10, 10], { painted: true });
  painted.children = [box("aside>span", [0, 0, 0, 0])];
  expect(overflowViolations(plain)).toEqual([]);
  expect(overflowViolations(clipping)).toEqual([]);
  expect(overflowViolations(painted)).toEqual([]);
});

test("collectBoxes walks the DOM with nth-child paths", () => {
  document.body.innerHTML = '<section class="x"><header></header><div><p>a</p></div></section>';
  const root = document.body.firstElementChild;
  if (!root) throw new Error("no root");
  const tree = collectBoxes(root);
  expect(tree.path).toBe("section");
  expect(tree.children.map((c) => c.path)).toEqual([
    "section>header:nth-child(1)",
    "section>div:nth-child(2)",
  ]);
  expect(tree.children[1]?.children[0]?.path).toBe("section>div:nth-child(2)>p:nth-child(1)");
});
