export type KeyState = ReadonlySet<string>;
export type KeyEvent = { type: "keydown" | "keyup" | "blur"; code: string };

export const GAME_KEYS: readonly string[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];

export function keysReducer(state: KeyState, e: KeyEvent): KeyState {
  if (e.type === "blur") return new Set();
  const next = new Set(state);
  if (e.type === "keydown") next.add(e.code);
  else next.delete(e.code);
  return next;
}
