import { Binding, type MemberRole } from "@kibo/schema";
import { isContainer, type LoroDoc, type LoroMap } from "loro-crdt";

export type UpdateAuthor = { userId: string; role: MemberRole };

function readBinding(raw: unknown, id: string): Binding | string {
  if (isContainer(raw)) return `binding ${id} must be a plain value`;
  const parsed = Binding.safeParse(raw);
  if (!parsed.success) return `binding ${id} is not a valid binding`;
  if (parsed.data.id !== id) return `binding ${id} is stored under another id`;
  return parsed.data;
}

const canonical = (value: unknown): string => JSON.stringify(value);

function creationViolation(binding: Binding, author: UpdateAuthor): string | null {
  if (binding.createdBy !== author.userId || binding.runner !== author.userId) {
    return `binding ${binding.id}: a new binding is created and run by its author`;
  }
  return null;
}

function rewriteViolation(previous: Binding, current: Binding, author: UpdateAuthor): string | null {
  if (current.createdBy !== previous.createdBy) return `binding ${current.id}: createdBy is frozen`;
  if (current.adapter !== previous.adapter) return `binding ${current.id}: adapter is frozen`;
  if (current.runner !== previous.runner) {
    const mayTakeOver = author.userId === previous.createdBy || author.role === "owner";
    if (current.runner !== author.userId || !mayTakeOver) {
      return `binding ${current.id}: only its creator or an owner takes over the runner, on their own account`;
    }
  }
  if (canonical(current.config) !== canonical(previous.config) && author.userId !== current.runner) {
    return `binding ${current.id}: only its runner changes its config`;
  }
  return null;
}

function bindingViolation(previous: unknown, raw: unknown, id: string, author: UpdateAuthor): string | null {
  const current = readBinding(raw, id);
  if (typeof current === "string") return current;
  const before = previous === undefined ? null : readBinding(previous, id);
  if (before === null || typeof before === "string") return creationViolation(current, author);
  if (canonical(before) === canonical(current)) return null;
  return rewriteViolation(before, current, author);
}

export function bindingsUpdateViolation(
  before: LoroDoc,
  after: LoroDoc,
  author: UpdateAuthor,
): string | null {
  const previous = before.getMap("bindings");
  const current = after.getMap("bindings");
  for (const id of current.keys()) {
    const raw = current.get(id);
    const known = previous.get(id);
    if (
      known !== undefined &&
      !isContainer(known) &&
      !isContainer(raw) &&
      canonical(known) === canonical(raw)
    ) {
      continue;
    }
    const reason = bindingViolation(known, raw, id, author);
    if (reason !== null) return reason;
  }
  return null;
}

export function bindingsSnapshotViolation(bindings: LoroMap, ownerId: string): string | null {
  for (const id of bindings.keys()) {
    const binding = readBinding(bindings.get(id), id);
    if (typeof binding === "string") return binding;
    if (binding.createdBy !== ownerId || binding.runner !== ownerId) {
      return `binding ${id}: a shared binding is created and run by the owner`;
    }
  }
  return null;
}
