import { expect, test } from "bun:test";
import { announce } from "./announcements";

const labelOf = (id: string | number) => String(id);
const event = (over: string | null) => ({
  active: {
    id: "EMIS-51",
    data: { current: undefined },
    rect: { current: { initial: null, translated: null } },
  },
  over:
    over === null
      ? null
      : {
          id: over,
          rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
          disabled: false,
          data: { current: undefined },
        },
  collisions: null,
  delta: { x: 0, y: 0 },
  activatorEvent: null,
});

test("a refused drop is announced with its reason instead of « déposé »", () => {
  const refusal = (_active: string | number, over: string | number) =>
    over === "in_progress" ? "EMIS-51 reste bloqué par Q14." : null;
  const a = announce(labelOf, refusal);
  expect(a.onDragEnd(event("in_progress"))).toBe("EMIS-51 reste bloqué par Q14.");
  expect(a.onDragEnd(event("blocked"))).toBe("EMIS-51 déposé sur blocked.");
  expect(a.onDragEnd(event(null))).toBe("Déplacement de EMIS-51 annulé.");
});
