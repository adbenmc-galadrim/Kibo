export function keepEscapeInReviseForm(e: KeyboardEvent): void {
  if (e.target instanceof Element && e.target.closest("[data-revise-form]")) e.preventDefault();
}
