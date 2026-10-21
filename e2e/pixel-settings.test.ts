import { expect, test } from "bun:test";
import {
  assertFixedNow,
  FIXED_NOW,
  isSiloScenario,
  SILO_APERCU,
  SILO_ATTENTE,
  SILO_GRAPHE,
  SILO_MAQUETTES,
  SILO_PRS,
} from "./pixel-settings";

const info = { version: "0.25.0-alpha.1", platform: "darwin" };

test("the frozen instant is the mockups' one", () => {
  expect(new Date(FIXED_NOW).toISOString()).toBe("2026-10-16T12:52:00.000Z");
});

test("a daemon that does not report its clock is refused", () => {
  expect(() => assertFixedNow(info)).toThrow("KIBO_FIXED_NOW");
});

test("a daemon with a free clock is refused", () => {
  expect(() => assertFixedNow({ ...info, fixedNow: null })).toThrow("KIBO_FIXED_NOW");
});

test("a daemon frozen at another instant is refused", () => {
  expect(() => assertFixedNow({ ...info, fixedNow: "2026-10-17T14:52:00+02:00" })).toThrow("KIBO_FIXED_NOW");
});

test("a daemon frozen at the same instant is accepted, whatever the notation", () => {
  expect(() => assertFixedNow({ ...info, fixedNow: FIXED_NOW })).not.toThrow();
  expect(() => assertFixedNow({ ...info, fixedNow: "2026-10-16T12:52:00.000Z" })).not.toThrow();
});

test("an answer that is not an object is refused", () => {
  expect(() => assertFixedNow(null)).toThrow("getAppInfo");
});

test("the five Silo scenarios are seeded under the frozen clock, no other one", () => {
  expect(isSiloScenario(SILO_MAQUETTES)).toBe(true);
  expect(isSiloScenario(SILO_ATTENTE)).toBe(true);
  expect(isSiloScenario(SILO_PRS)).toBe(true);
  expect(isSiloScenario(SILO_APERCU)).toBe(true);
  expect(isSiloScenario(SILO_GRAPHE)).toBe(true);
  expect(SILO_APERCU).toBe("silo-apercu");
  expect(SILO_ATTENTE).toBe("silo-attente");
  expect(SILO_PRS).toBe("silo-prs");
  expect(SILO_GRAPHE).toBe("silo-graphe");
  expect(isSiloScenario("question")).toBe(false);
});
