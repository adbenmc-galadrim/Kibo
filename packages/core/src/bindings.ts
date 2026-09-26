import { Binding, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

const map = (doc: LoroDoc) => doc.getMap("bindings");

function stored(raw: unknown, id: string): Binding {
  const parsed = Binding.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `binding ${id}: ${parsed.error.message}`);
  return parsed.data;
}

export function addBinding(doc: LoroDoc, input: Binding): Binding {
  const parsed = Binding.safeParse(input);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid binding: ${parsed.error.message}`);
  const binding = parsed.data;
  if (map(doc).get(binding.id) !== undefined)
    throw new KiboError("INVALID_INPUT", `binding ${binding.id} exists`);
  map(doc).set(binding.id, binding);
  doc.commit();
  return binding;
}

export function removeBinding(doc: LoroDoc, id: string): void {
  if (map(doc).get(id) === undefined) throw new KiboError("NOT_FOUND", `binding ${id} not found`);
  map(doc).delete(id);
  doc.commit();
}

export function listBindings(doc: LoroDoc): Binding[] {
  return Object.entries(map(doc).toJSON())
    .map(([id, raw]) => stored(raw, id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getBinding(doc: LoroDoc, id: string): Binding {
  const raw = map(doc).get(id);
  if (raw === undefined) throw new KiboError("NOT_FOUND", `binding ${id} not found`);
  return stored(raw, id);
}
