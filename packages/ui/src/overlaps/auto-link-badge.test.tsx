import { expect, mock, test } from "bun:test";
import type { AutoLink } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutoLinkBadge } from "./AutoLinkBadge";

const LINK: AutoLink = {
  id: "al1",
  projectId: "bou",
  linkId: "l1",
  fromTicketId: "12@1",
  toTicketId: "15@1",
  fromTicketKey: "BOU-12",
  toTicketKey: "BOU-15",
  ownerRunId: "r12",
  otherRunId: "r15",
  reason: "copy",
  detail: { path: "src/lib/format-date.ts", name: "formatDate" },
  at: new Date(2026, 9, 12, 14, 52).getTime(),
  status: "added",
  cancelledBy: null,
  cancelledAt: null,
};

test("screen 199: the badge explains the reason, the file and the date, and cancels", async () => {
  const onCancel = mock(async (_id: string) => {});
  render(<AutoLinkBadge link={LINK} otherKey="BOU-12" canEdit onCancel={onCancel} />);
  const user = userEvent.setup();
  const badge = screen.getByRole("button", { name: "Lien ajouté par Kibo avec BOU-12" });
  expect(badge.textContent).toBe("par Kibo");
  await user.click(badge);
  const card = await screen.findByRole("dialog");
  expect(card.textContent).toContain("Reprise de src/lib/format-date.ts");
  expect(card.textContent).toContain("12 oct. 14:52");
  await user.click(screen.getByRole("button", { name: "Annuler" }));
  expect(onCancel).toHaveBeenCalledWith("al1");
});

test("an import reason reads as such; a reader gets no cancel button", async () => {
  render(
    <AutoLinkBadge
      link={{ ...LINK, reason: "import" }}
      otherKey="BOU-12"
      canEdit={false}
      onCancel={() => {}}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Lien ajouté par Kibo avec BOU-12" }));
  expect((await screen.findByRole("dialog")).textContent).toContain("Import de src/lib/format-date.ts");
  expect(screen.queryByRole("button", { name: "Annuler" })).toBeNull();
});

test("a failed cancel is said in the card", async () => {
  const onCancel = mock(async () => {
    throw new Error("boom");
  });
  render(<AutoLinkBadge link={LINK} otherKey="BOU-12" canEdit onCancel={onCancel} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lien ajouté par Kibo avec BOU-12" }));
  await user.click(await screen.findByRole("button", { name: "Annuler" }));
  expect(await screen.findByText("Impossible d'annuler le lien.")).toBeTruthy();
});
