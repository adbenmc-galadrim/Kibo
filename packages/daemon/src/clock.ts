import { KiboError } from "@kibo/schema";
import { z } from "zod";

export type Clock = { now(): number; ticking(): number; today(): string; fixedNow: string | null };

const FixedNow = z.string().datetime({ offset: true });

const pad = (n: number, width: number) => String(n).padStart(width, "0");

export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

export function parseFixedNow(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  const parsed = FixedNow.safeParse(value);
  if (!parsed.success)
    throw new KiboError("INVALID_INPUT", `KIBO_FIXED_NOW must be an ISO 8601 instant, got ${value}`);
  return parsed.data;
}

export function createClock(fixedNow: string | null, systemNow: () => number = Date.now): Clock {
  const frozen = fixedNow === null ? null : Date.parse(fixedNow);
  const now = frozen === null ? systemNow : () => frozen;
  const startedAt = systemNow();
  const ticking = frozen === null ? systemNow : () => frozen + systemNow() - startedAt;
  return { now, ticking, today: () => localDate(now()), fixedNow };
}
