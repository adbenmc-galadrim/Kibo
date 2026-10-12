export type FlatItem = { key: string; parent: string | null; label: string; expanded: boolean | null };
export type KeyMove = { focus: string } | { expand: string } | { collapse: string } | null;

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const focusAt = (items: readonly FlatItem[], index: number): KeyMove => {
  const item = items[index];
  return item ? { focus: item.key } : null;
};

function typeAhead(items: readonly FlatItem[], index: number, letter: string): KeyMove {
  const wanted = fold(letter);
  const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
  const hit = ordered.find((item) => fold(item.label).startsWith(wanted));
  return hit && hit.key !== items[index]?.key ? { focus: hit.key } : null;
}

export function moveFocus(items: readonly FlatItem[], focused: string, key: string): KeyMove {
  const index = items.findIndex((item) => item.key === focused);
  const item = items[index];
  if (!item) return null;
  switch (key) {
    case "ArrowDown":
      return focusAt(items, index + 1);
    case "ArrowUp":
      return focusAt(items, index - 1);
    case "Home":
      return focusAt(items, 0);
    case "End":
      return focusAt(items, items.length - 1);
    case "ArrowRight":
      if (item.expanded === false) return { expand: item.key };
      return item.expanded && items[index + 1]?.parent === item.key ? focusAt(items, index + 1) : null;
    case "ArrowLeft":
      if (item.expanded) return { collapse: item.key };
      return item.parent ? { focus: item.parent } : null;
    default:
      return key.length === 1 && key.trim() !== "" ? typeAhead(items, index, key) : null;
  }
}
