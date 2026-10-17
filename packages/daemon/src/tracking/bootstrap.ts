import { KiboError } from "@kibo/schema";
import { type CodeService, type CodeServiceOptions, createCodeService } from "../code/code-service";
import type { PollPass, PrPoller } from "../code/pr-poller";
import type { Closer } from "../daemon-shutdown";
import type { Service } from "../service";
import { startTracking } from "./tracking-service";

export type CodeTrackingOptions = Pick<CodeServiceOptions, "env" | "prPollMs">;

export const PR_POLL_ENV = "KIBO_PR_POLL_MS";
export const MIN_PR_POLL_MS = 20;

const WITHOUT_POLL: Pick<PrPoller, "beforePoll"> = { beforePoll: () => () => {} };
const log = (what: string) => (e: unknown) => console.error(`[kibo-daemon] ${what}`, e);

export function prPollMsFromEnv(env: Record<string, string | undefined>): number | undefined {
  const raw = env[PR_POLL_ENV];
  if (raw === undefined || raw === "") return undefined;
  const ms = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (ms !== 0 && !(ms >= MIN_PR_POLL_MS))
    throw new KiboError(
      "INVALID_INPUT",
      `${PR_POLL_ENV} must be 0 or a whole number of milliseconds of at least ${MIN_PR_POLL_MS}, got ${raw}`,
    );
  return ms;
}

export function startCodeTracking(
  service: Service,
  closers: Closer[],
  opts: CodeTrackingOptions = {},
  passes: readonly PollPass[] = [],
): CodeService {
  const prPollMs = opts.prPollMs ?? prPollMsFromEnv(process.env);
  const code = createCodeService(service, { ...opts, ...(prPollMs !== undefined && { prPollMs }) });
  const poller = code.poller ?? WITHOUT_POLL;
  const tracking = startTracking({
    service,
    poller,
    refsChanged: (listener) => code.onChange((e) => listener(e.projectId)),
    log,
    ...(opts.env && { env: opts.env }),
  });
  const removePasses = passes.map((pass) => poller.beforePoll(pass));
  closers.push(async () => {
    for (const remove of removePasses) remove();
    tracking.stop();
    code.stop();
    await Promise.all([tracking.idle(), code.poller?.tick()]);
  });
  return code;
}
