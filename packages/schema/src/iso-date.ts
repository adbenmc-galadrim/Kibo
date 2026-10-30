export type IsoDate = string;
type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const EPOCH_WEEKDAY_INDEX = 3;

export function dayNumber(date: IsoDate): number {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export const dateOf = (day: number): IsoDate => new Date(day * DAY_MS).toISOString().slice(0, 10);

export const addDays = (date: IsoDate, days: number): IsoDate => dateOf(dayNumber(date) + days);

const WEEKDAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export function isoWeekday(date: IsoDate): IsoWeekday {
  const index = (((dayNumber(date) + EPOCH_WEEKDAY_INDEX) % WEEK_DAYS) + WEEK_DAYS) % WEEK_DAYS;
  return WEEKDAYS[index] ?? 1;
}

export const nextMonday = (date: IsoDate): IsoDate => addDays(date, WEEK_DAYS + 1 - isoWeekday(date));
