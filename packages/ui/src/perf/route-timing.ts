import { onRpc } from "../api";

const QUIET_REPORT_MS = 1000;

export type RouteTimingRow = { route: string; ms: number; longTasks: number } & Record<
  string,
  string | number
>;

type Unsubscribe = () => void;

type RouteTimingDeps = {
  mark(name: string): void;
  measure(name: string, startMark: string): number;
  currentRoute(): string;
  onRpc(listener: (method: string) => void): Unsubscribe;
  onHashChange(listener: () => void): Unsubscribe;
  onLongTask(listener: () => void): Unsubscribe;
  afterPaint(listener: () => void): void;
  whenQuiet(listener: () => void): Unsubscribe;
  report(rows: RouteTimingRow[]): void;
};

function observeLongTasks(listener: () => void): Unsubscribe {
  if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return () => {};
  const observer = new PerformanceObserver((list) => {
    for (const _ of list.getEntries()) listener();
  });
  observer.observe({ entryTypes: ["longtask"] });
  return () => observer.disconnect();
}

const browserDeps = (): RouteTimingDeps => ({
  mark: (name) => performance.mark(name),
  measure: (name, startMark) => Math.round(performance.measure(name, startMark).duration),
  currentRoute: () => location.hash || "#/",
  onRpc,
  onHashChange: (listener) => {
    addEventListener("hashchange", listener);
    return () => removeEventListener("hashchange", listener);
  },
  onLongTask: observeLongTasks,
  afterPaint: (listener) => requestAnimationFrame(() => requestAnimationFrame(listener)),
  whenQuiet: (listener) => {
    const timer = setTimeout(listener, QUIET_REPORT_MS);
    return () => clearTimeout(timer);
  },
  report: (rows) => console.table(rows),
});

export function startRouteTiming(deps: RouteTimingDeps = browserDeps()): Unsubscribe {
  const rows: RouteTimingRow[] = [];
  let cancelReport: Unsubscribe = () => {};
  const current = () => rows.at(-1);
  const startRoute = () => {
    const name = `kibo:route:${rows.length}`;
    const startMark = `${name}:start`;
    deps.mark(startMark);
    const row: RouteTimingRow = { route: deps.currentRoute(), ms: 0, longTasks: 0 };
    rows.push(row);
    deps.afterPaint(() => {
      row.ms = deps.measure(name, startMark);
    });
    cancelReport();
    cancelReport = deps.whenQuiet(() => deps.report(rows));
  };
  const offs = [
    deps.onHashChange(startRoute),
    deps.onRpc((method) => {
      const row = current();
      if (row) row[method] = Number(row[method] ?? 0) + 1;
    }),
    deps.onLongTask(() => {
      const row = current();
      if (row) row.longTasks += 1;
    }),
  ];
  return () => {
    cancelReport();
    for (const off of offs) off();
  };
}
