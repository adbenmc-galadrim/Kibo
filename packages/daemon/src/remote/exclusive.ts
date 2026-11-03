type Exclusive = <R>(work: () => Promise<R>) => Promise<R>;

export function createExclusive(): Exclusive {
  let tail: Promise<unknown> = Promise.resolve();
  return (work) => {
    const run = tail.then(work, work);
    tail = run.catch(() => undefined);
    return run;
  };
}
