import { expect, test } from "bun:test";
import { renderNote } from "./markdown";

const tickets = new Map([
  ["KIB-12", { id: "t12", title: "Schéma Loro des tickets", statusId: "in_progress" as const }],
  ["KIB-1", { id: "t1", title: "Monorepo", statusId: "done" as const }],
]);

test("ticket keys become chips, except inside code", () => {
  const html = renderNote("Voir KIB-12 et KIB-99.\n\n`KIB-12`\n\n```\nKIB-12\n```", tickets);
  expect(html.match(/data-ticket-key="KIB-12"/g)).toHaveLength(1);
  expect(html).toContain("Schéma Loro des tickets");
  expect(html).toContain("KIB-99");
  expect(html).not.toContain('data-ticket-key="KIB-99"');
});

test("raw HTML is escaped and dangerous links are not rendered", () => {
  const html = renderNote(
    '<img src=x onerror="alert(1)"> [x](javascript:alert(1)) <script>boom()</script>',
    tickets,
  );
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<script");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain("&lt;img");
});

test("wiki links and relative Markdown links are marked for in-app navigation", () => {
  const html = renderNote(
    "[[decisions-architecture|archi]] et [idées](idees.md) et [site](https://kibo.dev)",
    tickets,
  );
  expect(html).toContain('data-note-href="decisions-architecture"');
  expect(html).toContain(">archi<");
  expect(html).toContain('data-note-href="idees.md"');
  expect(html).toContain('href="https://kibo.dev"');
});

test("relative assets/ images are marked for the asset call, without a source", () => {
  const html = renderNote("![x](assets/a.png) ![y](https://k.dev/b.png) ![z](assets/../c.png)", tickets);
  expect(html).toContain('<img data-asset="assets/a.png" alt="x">');
  expect(html).not.toContain('src="assets/a.png"');
  expect(html).toContain('<img src="https://k.dev/b.png" alt="y">');
  expect(html).not.toContain('data-asset="assets/../c.png"');
});

test("a GFM task item renders a real checkbox bound to its source line", () => {
  const html = renderNote("# T\n\n- [x] Relire la spec\n- [ ] Tester KIB-1\n", tickets);
  expect(html).toContain(
    '<li class="task"><input type="checkbox" data-task-line="2" checked>Relire la spec</li>',
  );
  expect(html).toContain('<li class="task"><input type="checkbox" data-task-line="3">Tester ');
  expect(html).toContain('data-ticket-key="KIB-1"');
  expect(html).not.toContain("[x]");
  expect(html).toContain('<ul class="contains-task">');
});

test("only a leading GFM marker makes a checkbox", () => {
  const none = renderNote(
    "- `[x]` code\n- texte [x] milieu\n-[x] collé\n\n[x] hors liste\n\n- [x]collé\n",
    tickets,
  );
  expect(none).not.toContain('type="checkbox"');
  const ordered = renderNote("1. [ ] première\n   - [x] imbriquée\n", tickets);
  expect(ordered).toContain('data-task-line="0"');
  expect(ordered).toContain('data-task-line="1" checked');
});

test("readonly tasks are disabled", () => {
  expect(renderNote("- [ ] a\n", tickets, { tasks: "readonly" })).toContain(
    '<input type="checkbox" data-task-line="0" disabled>',
  );
});
