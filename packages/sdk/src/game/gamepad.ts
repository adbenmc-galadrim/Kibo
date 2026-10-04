export type PadState = { connected: boolean; axes: readonly number[]; buttons: readonly boolean[] };

export const NO_PAD: PadState = { connected: false, axes: [], buttons: [] };

export function readGamepad(pad: Gamepad | null, deadzone = 0.15): PadState {
  if (!pad) return NO_PAD;
  return {
    connected: pad.connected,
    axes: pad.axes.map((a) => (Math.abs(a) < deadzone ? 0 : a)),
    buttons: pad.buttons.map((b) => b.pressed),
  };
}

export const samePad = (a: PadState, b: PadState): boolean =>
  a.connected === b.connected &&
  a.axes.length === b.axes.length &&
  a.buttons.length === b.buttons.length &&
  a.axes.every((v, i) => v === b.axes[i]) &&
  a.buttons.every((v, i) => v === b.buttons[i]);
