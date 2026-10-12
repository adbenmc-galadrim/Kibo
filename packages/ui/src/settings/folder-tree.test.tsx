import { expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FolderTree, type TreeEntry } from "./FolderTree";

const activated: string[] = [];

const leaf = (key: string, label: string): TreeEntry => ({
  key,
  label,
  icon: null,
  onActivate: () => activated.push(key),
});

const entries: TreeEntry[] = [
  { ...leaf("ws", "Workspace"), count: 2, children: [leaf("conv", "conventions.md")] },
  { ...leaf("kibo", "Kibo"), count: 3, badge: "Lecture seule", children: [leaf("kibo.md", "kibo.md")] },
  leaf("fac", "Facturation"),
];

function Harness({ onToggle }: { onToggle?: (key: string) => void }) {
  const [expanded, setExpanded] = useState(new Set(["ws"]));
  const toggle = (key: string) => {
    onToggle?.(key);
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return (
    <FolderTree label="Dossiers" entries={entries} selected="conv" expanded={expanded} onToggle={toggle} />
  );
}

test("the tree exposes its items, their level, expansion, selection and count", () => {
  render(<Harness />);
  const tree = screen.getByRole("tree", { name: "Dossiers" });
  const ws = within(tree).getByRole("treeitem", { name: "Workspace" });
  expect(ws.getAttribute("aria-expanded")).toBe("true");
  expect(ws.getAttribute("aria-level")).toBe("1");
  expect(within(ws).getByText("2 .md")).toBeTruthy();
  const conv = within(tree).getByRole("treeitem", { name: "conventions.md" });
  expect(conv.getAttribute("aria-selected")).toBe("true");
  expect(conv.getAttribute("aria-level")).toBe("2");
  expect(conv.getAttribute("tabindex")).toBe("0");
  expect(within(tree).getByRole("treeitem", { name: "Kibo" }).getAttribute("aria-expanded")).toBe("false");
  expect(within(tree).getByText("Lecture seule")).toBeTruthy();
  expect(within(tree).queryByRole("treeitem", { name: "kibo.md" })).toBeNull();
  expect(within(tree).getByRole("treeitem", { name: "Facturation" }).hasAttribute("aria-expanded")).toBe(
    false,
  );
});

test("a click activates an item; the chevron only folds", async () => {
  activated.length = 0;
  const onToggle = mock((_key: string) => {});
  render(<Harness onToggle={onToggle} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("Facturation"));
  expect(activated).toEqual(["fac"]);
  await user.click(screen.getByRole("button", { name: "Déplier Kibo" }));
  expect(onToggle).toHaveBeenCalledWith("kibo");
  expect(screen.getByRole("treeitem", { name: "kibo.md" })).toBeTruthy();
  expect(activated).toEqual(["fac"]);
  expect(screen.getByRole("button", { name: "Replier Kibo" }).getAttribute("tabindex")).toBe("-1");
});

test("the keyboard walks, folds and activates", async () => {
  activated.length = 0;
  render(<Harness />);
  const user = userEvent.setup();
  screen.getByRole("treeitem", { name: "conventions.md" }).focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("treeitem", { name: "Kibo" }));
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("treeitem", { name: "Kibo" }).getAttribute("aria-expanded")).toBe("true");
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("treeitem", { name: "kibo.md" }));
  await user.keyboard("{Enter}");
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(screen.getByRole("treeitem", { name: "Workspace" }));
  await user.keyboard("f");
  expect(document.activeElement).toBe(screen.getByRole("treeitem", { name: "Facturation" }));
  await user.keyboard(" ");
  expect(activated).toEqual(["kibo.md", "fac"]);
});
