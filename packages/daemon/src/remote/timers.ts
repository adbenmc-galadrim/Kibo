export type RemoteTimers = {
  after(ms: number, run: () => void): () => void;
  every(ms: number, run: () => void): () => void;
};

export const realTimers: RemoteTimers = {
  after: (ms, run) => {
    const handle = setTimeout(run, ms);
    return () => clearTimeout(handle);
  },
  every: (ms, run) => {
    const handle = setInterval(run, ms);
    return () => clearInterval(handle);
  },
};
