import { type CodeService, type CodeServiceOptions, createCodeService } from "../code/code-service";
import type { PrPoller } from "../code/pr-poller";
import type { Closer } from "../daemon-shutdown";
import type { Service } from "../service";
import { startTracking } from "./tracking-service";

export type CodeTrackingOptions = Pick<CodeServiceOptions, "env" | "prPollMs">;

const WITHOUT_POLL: Pick<PrPoller, "beforePoll"> = { beforePoll: () => () => {} };
const log = (what: string) => (e: unknown) => console.error(`[kibo-daemon] ${what}`, e);

export function startCodeTracking(
  service: Service,
  closers: Closer[],
  opts: CodeTrackingOptions = {},
): CodeService {
  const code = createCodeService(service, opts);
  const tracking = startTracking({
    service,
    poller: code.poller ?? WITHOUT_POLL,
    refsChanged: (listener) => code.onChange((e) => listener(e.projectId)),
    log,
    ...(opts.env && { env: opts.env }),
  });
  closers.push(async () => {
    tracking.stop();
    code.stop();
    await tracking.idle();
  });
  return code;
}
