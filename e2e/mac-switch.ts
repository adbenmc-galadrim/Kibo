import type { Socket } from "bun";

type Sink = { socket: Socket<Pipe> | null; queue: Uint8Array[]; held: boolean };
type Pipe = { to: Sink; from: Sink };

export type MacSwitch = { url: string; off(): void; on(): void; stall(): void; stop(): void };

function flush(sink: Sink): void {
  const socket = sink.socket;
  if (socket === null || sink.held) return;
  while (sink.queue.length > 0) {
    const chunk = sink.queue[0] ?? new Uint8Array();
    const written = socket.write(chunk);
    if (written < chunk.length) {
      sink.queue[0] = chunk.subarray(Math.max(written, 0));
      return;
    }
    sink.queue.shift();
  }
}

function push(sink: Sink, chunk: Uint8Array): void {
  sink.queue.push(new Uint8Array(chunk));
  flush(sink);
}

const handlers = {
  data: (socket: Socket<Pipe>, chunk: Uint8Array) => push(socket.data.to, chunk),
  drain: (socket: Socket<Pipe>) => flush(socket.data.from),
  close: (socket: Socket<Pipe>) => {
    socket.data.to.socket?.end();
  },
  error: (socket: Socket<Pipe>) => {
    socket.end();
  },
};

export function startMacSwitch(opts: { port: number; target: string }): MacSwitch {
  const target = new URL(opts.target);
  let powered = true;
  const clients = new Set<Socket<Pipe>>();

  const open = (client: Socket<Pipe>) => {
    if (!powered) {
      client.end();
      return;
    }
    const toClient: Sink = { socket: client, queue: [], held: false };
    const toServer: Sink = { socket: null, queue: [], held: false };
    client.data = { to: toServer, from: toClient };
    clients.add(client);
    Bun.connect<Pipe>({
      hostname: target.hostname,
      port: Number(target.port),
      data: { to: toClient, from: toServer },
      socket: {
        ...handlers,
        open: (server) => {
          toServer.socket = server;
          flush(toServer);
        },
      },
    }).catch(() => {
      client.end();
    });
  };

  const listener = Bun.listen<Pipe>({
    hostname: "127.0.0.1",
    port: opts.port,
    socket: {
      ...handlers,
      open,
      close: (client) => {
        clients.delete(client);
        client.data?.to.socket?.end();
      },
    },
  });

  return {
    url: `http://127.0.0.1:${listener.port}`,
    off: () => {
      powered = false;
      for (const client of clients) {
        client.data.to.socket?.end();
        client.end();
      }
    },
    on: () => {
      powered = true;
    },
    stall: () => {
      for (const client of clients) client.data.from.held = true;
    },
    stop: () => listener.stop(true),
  };
}
