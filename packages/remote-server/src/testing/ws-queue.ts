type Typed = { type: string };

export type SocketQueue<M extends Typed> = {
  received: M[];
  send(message: unknown): void;
  next<T extends M["type"]>(type: T, timeoutMs?: number): Promise<Extract<M, { type: T }>>;
  close(): Promise<number>;
  closed: Promise<number>;
};

type Waiter<M> = { type: string; resolve(message: M): void };

const DEFAULT_WAIT_MS = 2_000;

export function openSocket<M extends Typed>(
  url: string,
  headers: Record<string, string>,
  parse: (data: unknown) => M,
  intercept: (message: M) => boolean = () => false,
): Promise<SocketQueue<M>> {
  const socket = new WebSocket(url, { headers });
  const received: M[] = [];
  const pending: M[] = [];
  const waiters: Waiter<M>[] = [];
  let resolveClosed: (code: number) => void = () => {};
  const closed = new Promise<number>((resolve) => {
    resolveClosed = resolve;
  });
  socket.addEventListener("close", (event) => resolveClosed(event.code));
  socket.addEventListener("message", (event) => {
    const message = parse(JSON.parse(String(event.data)));
    received.push(message);
    if (intercept(message)) return;
    const waiter = waiters.findIndex((w) => w.type === message.type);
    if (waiter === -1) pending.push(message);
    else waiters.splice(waiter, 1)[0]?.resolve(message);
  });
  const isType = <T extends M["type"]>(type: T, message: M): message is Extract<M, { type: T }> =>
    message.type === type;
  const next = <T extends M["type"]>(type: T, timeoutMs = DEFAULT_WAIT_MS) =>
    new Promise<Extract<M, { type: T }>>((resolve, reject) => {
      const index = pending.findIndex((m) => m.type === type);
      const found = index === -1 ? undefined : pending.splice(index, 1)[0];
      if (found && isType(type, found)) return resolve(found);
      const timer = setTimeout(() => reject(new Error(`no ${type} within ${timeoutMs} ms`)), timeoutMs);
      waiters.push({
        type,
        resolve: (message) => {
          clearTimeout(timer);
          if (isType(type, message)) resolve(message);
        },
      });
    });
  const queue: SocketQueue<M> = {
    received,
    send: (message) => socket.send(JSON.stringify(message)),
    next,
    close: () => {
      socket.close();
      return closed;
    },
    closed,
  };
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(queue), { once: true });
    socket.addEventListener("error", () => reject(new Error(`cannot open ${url}`)), { once: true });
  });
}
