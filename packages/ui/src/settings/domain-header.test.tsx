import { expect, mock, test } from "bun:test";
import { DOMAIN_COLORS } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DomainHeader } from "./DomainHeader";

const core = { id: "core", name: "Core", color: "#14B8A6", owner: { scope: "workspace" } } as const;
const show = (onRename = mock((_n: string) => Promise.resolve(true))) => {
  const onColor = mock((_c: string) => Promise.resolve(true));
  const onDelete = mock(() => {});
  render(
    <DomainHeader
      domain={core}
      usage={9}
      projects={1}
      scope={null}
      readOnly={false}
      onRename={onRename}
      onColor={onColor}
      onDelete={onDelete}
    />,
  );
  return { onRename, onColor, onDelete, user: userEvent.setup() };
};

test("the pencil opens an inline field; Enter renames, Escape cancels", async () => {
  const { user, onRename } = show();
  expect(screen.getByRole("heading", { name: "Domaine · Core" })).toBeTruthy();
  expect(screen.getByText("utilisé par 9 tickets")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  const field = screen.getByRole("textbox", { name: "Nouveau nom" });
  expect((field as HTMLInputElement).value).toBe("Core");
  await user.clear(field);
  await user.type(field, "Noyau{Enter}");
  expect(onRename).toHaveBeenCalledWith("Noyau");
  await screen.findByRole("heading", { name: "Domaine · Core" });
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(onRename).toHaveBeenCalledTimes(1);
});

test("a refused rename keeps the field open", async () => {
  const { user } = show(mock((_n: string) => Promise.resolve(false)));
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  await user.type(screen.getByRole("textbox", { name: "Nouveau nom" }), "{Enter}");
  expect(screen.getByRole("textbox", { name: "Nouveau nom" })).toBeTruthy();
});

test("the swatch opens the seven palette colors and picks one", async () => {
  const { user, onColor } = show();
  await user.click(screen.getByRole("button", { name: "Couleur du domaine Core" }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.map((i) => i.getAttribute("aria-label"))).toEqual(DOMAIN_COLORS.map((c) => `Couleur ${c}`));
  await user.click(items[1] as HTMLElement);
  expect(onColor).toHaveBeenCalledWith("#6366F1");
});

test("the trash asks the page to delete", async () => {
  const { user, onDelete } = show();
  await user.click(screen.getByRole("button", { name: "Supprimer le domaine Core" }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test("the header says whose domain it is and where it is used", () => {
  const noop = () => Promise.resolve(true);
  const { rerender } = render(
    <DomainHeader
      domain={core}
      usage={6}
      projects={2}
      scope={null}
      readOnly={false}
      onRename={noop}
      onColor={noop}
      onDelete={() => {}}
    />,
  );
  expect(screen.getByText("domaine du workspace")).toBeTruthy();
  expect(screen.getByText("utilisé par 6 tickets dans 2 projets")).toBeTruthy();
  const sync = { ...core, name: "Sync", owner: { scope: "project", projectId: "kibo" } } as const;
  rerender(
    <DomainHeader
      domain={sync}
      usage={8}
      projects={1}
      scope={{ name: "Kibo", color: "#F97316" }}
      readOnly
      onRename={noop}
      onColor={noop}
      onDelete={() => {}}
    />,
  );
  expect(screen.getByText("domaine de Kibo")).toBeTruthy();
  expect(screen.getByText("utilisé par 8 tickets")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
