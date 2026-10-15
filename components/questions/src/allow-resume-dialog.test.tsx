import { expect, test } from "bun:test";
import { KiboError, parentTicketDetail } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllowResumeDialog } from "./AllowResumeDialog";

const ALLOWANCE = { rules: ["Bash(pnpm *)"], addDirs: [], left: [] };

test("a parent ticket refused by the daemon is told in French", async () => {
  render(
    <AllowResumeDialog
      allowance={ALLOWANCE}
      runLabel="emis · full-delivery · EMIS-15"
      onOpenChange={() => undefined}
      onConfirm={() => Promise.reject(new KiboError("TICKET_HAS_CHILDREN", parentTicketDetail(2)))}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Autoriser et relancer" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Impossible d'autoriser et de relancer : ce ticket regroupe des sous-tickets",
  );
});
