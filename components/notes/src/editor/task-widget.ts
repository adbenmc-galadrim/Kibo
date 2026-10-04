import { WidgetType } from "@codemirror/view";
import { frEditor } from "../fr-editor";

export class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: TaskWidget): boolean {
    return other.checked === this.checked;
  }
  toDOM(): HTMLElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.dataset.task = this.checked ? "done" : "todo";
    input.setAttribute("aria-label", this.checked ? frEditor.taskDone : frEditor.taskTodo);
    input.className = "mr-1 size-3.5 cursor-pointer align-middle accent-foreground";
    return input;
  }
  ignoreEvent(): boolean {
    return false;
  }
}
