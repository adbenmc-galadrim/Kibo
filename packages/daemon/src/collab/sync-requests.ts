import { isKiboErrorCode, KiboError, type ServerFrame } from "@kibo/schema";

type Waiter = {
  resolve(frame: ServerFrame): void;
  reject(error: KiboError): void;
  cancel(): void;
};

const isFrame = <T extends ServerFrame["type"]>(
  frame: ServerFrame,
  type: T,
): frame is Extract<ServerFrame, { type: T }> => frame.type === type;

export type Timer = (fn: () => void, ms: number) => () => void;

export class RequestTable {
  private readonly waiters = new Map<string, Waiter>();

  constructor(private readonly setTimer: Timer) {}

  track<T extends ServerFrame["type"]>(
    requestId: string,
    expect: T,
    timeoutMs: number,
  ): Promise<Extract<ServerFrame, { type: T }>> {
    return new Promise((resolve, reject) => {
      const cancel = this.setTimer(() => {
        this.waiters.delete(requestId);
        reject(new KiboError("SYNC_OFFLINE", `request ${requestId} timed out`));
      }, timeoutMs);
      this.waiters.set(requestId, {
        resolve: (frame) => {
          if (isFrame(frame, expect)) resolve(frame);
          else reject(new KiboError("INTERNAL", `expected ${expect}, got ${frame.type}`));
        },
        reject,
        cancel,
      });
    });
  }

  forget(requestId: string, error: KiboError): void {
    const waiter = this.waiters.get(requestId);
    if (!waiter) return;
    this.waiters.delete(requestId);
    waiter.cancel();
    waiter.reject(error);
  }

  settle(frame: ServerFrame): boolean {
    if (!("requestId" in frame) || frame.requestId === null) return false;
    const waiter = this.waiters.get(frame.requestId);
    if (!waiter) return false;
    this.waiters.delete(frame.requestId);
    waiter.cancel();
    if (frame.type === "error") {
      const code = isKiboErrorCode(frame.code) ? frame.code : "INTERNAL";
      waiter.reject(new KiboError(code, frame.message));
    } else waiter.resolve(frame);
    return true;
  }

  failAll(error: KiboError): void {
    for (const id of [...this.waiters.keys()]) this.forget(id, error);
  }
}
