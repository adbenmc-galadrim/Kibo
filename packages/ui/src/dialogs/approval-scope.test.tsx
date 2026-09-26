import { expect, test } from "bun:test";
import { Dialog, DialogContent, DialogTitle } from "@kibo/sdk/ui/dialog";
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ApprovalScope, useApprovalScope, useReportApproval } from "./approval-scope";

let approve: (on: boolean) => void = () => {};

function Approval() {
  const [on, setOn] = useState(false);
  approve = setOn;
  useReportApproval(on);
  return null;
}

function Level({ title, children }: { title: string; children?: React.ReactNode }) {
  const scope = useApprovalScope();
  return (
    <Dialog open>
      <DialogContent hidden={scope.hidden} aria-describedby={undefined}>
        <DialogTitle>{title}</DialogTitle>
        <input aria-label={`${title} champ`} defaultValue="" />
        <ApprovalScope scope={scope}>{children}</ApprovalScope>
      </DialogContent>
    </Dialog>
  );
}

const dialog = (name: string) => screen.getByText(name).closest("[role=dialog]");

test("every enclosing dialog is hidden, not unmounted, while an approval is shown", async () => {
  render(
    <Level title="Ajouter">
      <Level title="Créer">
        <Approval />
      </Level>
    </Level>,
  );
  const field = screen.getByLabelText("Créer champ") as HTMLInputElement;
  field.value = "gardé";
  act(() => approve(true));
  expect(dialog("Ajouter")?.hasAttribute("hidden")).toBe(true);
  expect(dialog("Créer")?.hasAttribute("hidden")).toBe(true);
  expect(document.querySelectorAll("[data-slot=dialog-overlay]:not([hidden])")).toHaveLength(0);
  act(() => approve(false));
  expect(document.querySelectorAll("[data-slot=dialog-overlay]:not([hidden])")).toHaveLength(2);
  expect(dialog("Ajouter")?.hasAttribute("hidden")).toBe(false);
  expect(dialog("Créer")?.hasAttribute("hidden")).toBe(false);
  expect((screen.getByLabelText("Créer champ") as HTMLInputElement).value).toBe("gardé");
});

test("an approval that unmounts shows the dialogs again", () => {
  function Toggle() {
    const [shown, setShown] = useState(true);
    approve = (on) => (on ? undefined : setShown(false));
    return shown ? <AlwaysApproving /> : null;
  }
  function AlwaysApproving() {
    useReportApproval(true);
    return null;
  }
  render(
    <Level title="Créer">
      <Toggle />
    </Level>,
  );
  expect(dialog("Créer")?.hasAttribute("hidden")).toBe(true);
  act(() => approve(false));
  expect(dialog("Créer")?.hasAttribute("hidden")).toBe(false);
});
