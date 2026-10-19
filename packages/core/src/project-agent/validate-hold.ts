import { ticketByKey } from "./expected";
import { type Check, nodeOf, type Scan, touch } from "./validate-scan";

const isStep = (scan: Scan, ref: string): boolean => (scan.parents.get(nodeOf(scan, ref)) ?? null) !== null;

const setHold: Check<"setHold"> = (scan, a) => {
  if (!isStep(scan, a.ticket)) return ["hold set on a step, not a feature"];
  if (a.reason !== null && ticketByKey(scan.ctx.project)(a.ticket)?.statusId === "done")
    return ["a delivered step cannot be held"];
  return touch(scan, `${a.ticket}.hold`);
};

export const holdChecks = { setHold };
