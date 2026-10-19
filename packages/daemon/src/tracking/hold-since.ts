import type { CommandInterceptor } from "../docs";

export function holdSinceInterceptor(today: () => string): CommandInterceptor {
  return (_projectId, cmd) =>
    cmd.method === "setHold" && cmd.reason !== null ? { ...cmd, since: today() } : cmd;
}
