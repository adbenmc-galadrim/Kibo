import { beforeEach, expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, KiboError, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { createProjectStore } from "./project-store";

const snapshotOf = (id: string, name = id): ProjectSnapshot => ({
  meta: {
    id,
    name,
    key: "SILO",
    folder: null,
    color: "#14B8A6",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "SILO-1",
  sprints: [],
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GROUPING_WINDOW_MS = 130;

let getProjectCalls: string[] = [];
let names = new Map<string, string>();
let failure: Error | null = null;
let projectListeners = new Set<(id: string | null) => void>();
let connectionListeners = new Set<() => void>();
let unauthorizedListeners = new Set<() => void>();
let writeDoneListeners = new Set<(id: string | null) => void>();
let online = true;

const fakeClient = {
  rpc: (req: RpcRequest) => {
    if (req.method !== "getProject") throw new Error(`unexpected ${req.method}`);
    getProjectCalls.push(req.projectId);
    if (failure) return Promise.reject(failure);
    return Promise.resolve(snapshotOf(req.projectId, names.get(req.projectId)));
  },
  subscribe: (listener: (id: string | null) => void) => {
    projectListeners.add(listener);
    return () => projectListeners.delete(listener);
  },
  online: () => online,
  onConnection: (listener: () => void) => {
    connectionListeners.add(listener);
    return () => connectionListeners.delete(listener);
  },
};

const newStore = () =>
  createProjectStore({
    getProject: (projectId) =>
      fakeClient.rpc({ method: "getProject", projectId }) as Promise<ProjectSnapshot>,
    subscribe: fakeClient.subscribe,
    online: fakeClient.online,
    onConnection: fakeClient.onConnection,
    onUnauthorized: (l) => {
      unauthorizedListeners.add(l);
      return () => unauthorizedListeners.delete(l);
    },
    onWriteDone: (l) => {
      writeDoneListeners.add(l);
      return () => writeDoneListeners.delete(l);
    },
  });

const emit = (id: string | null) => {
  for (const l of [...projectListeners]) l(id);
};
const setOnline = (value: boolean) => {
  online = value;
  for (const l of [...connectionListeners]) l();
};

beforeEach(() => {
  getProjectCalls = [];
  names = new Map();
  failure = null;
  projectListeners = new Set();
  connectionListeners = new Set();
  unauthorizedListeners = new Set();
  writeDoneListeners = new Set();
  online = true;
});

test("opening the same project twice calls getProject once", async () => {
  const store = newStore();
  const [a, b] = await Promise.all([store.ensure("silo"), store.ensure("silo")]);
  expect(a).toBe(b);
  await store.ensure("silo");
  expect(getProjectCalls).toEqual(["silo"]);
});

test("a project event triggers a single getProject shared by two consumers within 100 ms", async () => {
  const store = newStore();
  await store.ensure("silo");
  names.set("silo", "after");
  emit("silo");
  emit("silo");
  const first = store.ensure("silo");
  await wait(20);
  emit("silo");
  const second = store.ensure("silo");
  expect(getProjectCalls).toEqual(["silo"]);
  const [a, b] = await Promise.all([first, second]);
  expect(a.meta.name).toBe("after");
  expect(b.meta.name).toBe("after");
  await wait(GROUPING_WINDOW_MS);
  expect(getProjectCalls).toEqual(["silo", "silo"]);
  expect(store.peek("silo")?.meta.name).toBe("after");
});

test("a consumer notified by the event never reads the outdated view", async () => {
  const store = newStore();
  store.connect();
  await store.ensure("silo");
  names.set("silo", "after");
  const reads: Promise<ProjectSnapshot>[] = [];
  fakeClient.subscribe((id) => {
    if (id === "silo") reads.push(store.ensure("silo"));
  });
  emit("silo");
  const [read] = await Promise.all(reads);
  expect(read?.meta.name).toBe("after");
});

test("an event landing during a load refreshes again", async () => {
  const store = newStore();
  store.connect();
  const loading = store.ensure("silo");
  emit("silo");
  await loading;
  names.set("silo", "after");
  await wait(GROUPING_WINDOW_MS);
  expect(getProjectCalls).toEqual(["silo", "silo"]);
  expect(store.peek("silo")?.meta.name).toBe("after");
});

test("a finished write makes the next read wait for fresh data", async () => {
  const store = newStore();
  store.connect();
  await store.ensure("silo");
  names.set("silo", "after");
  for (const l of writeDoneListeners) l("silo");
  expect((await store.ensure("silo")).meta.name).toBe("after");
});

test("an event on an unknown project loads nothing", async () => {
  const store = newStore();
  store.connect();
  emit("other");
  emit(null);
  await wait(GROUPING_WINDOW_MS);
  expect(getProjectCalls).toEqual([]);
});

test("clearProjects empties the store on unauthorized", async () => {
  const store = newStore();
  store.connect();
  await store.ensure("silo");
  for (const l of [...unauthorizedListeners]) l();
  expect(store.peek("silo")).toBeNull();
  expect(projectListeners.size).toBe(0);
});

test("the store is emptied when the daemon disconnects and reloads what is watched", async () => {
  const store = newStore();
  const release = store.watch("silo");
  await store.ensure("silo");
  await store.ensure("idle");
  setOnline(false);
  expect(store.peek("silo")).toBeNull();
  expect(store.peek("idle")).toBeNull();
  getProjectCalls = [];
  setOnline(true);
  await wait(0);
  expect(getProjectCalls).toEqual(["silo"]);
  expect(store.peek("silo")?.meta.id).toBe("silo");
  release();
});

test("a load landing after the store was emptied is not kept", async () => {
  const store = newStore();
  const loading = store.ensure("silo");
  store.clear();
  await loading;
  expect(store.peek("silo")).toBeNull();
});

test("a failed load is retried and a deleted project leaves the store", async () => {
  const store = newStore();
  await store.ensure("silo");
  store.connect();
  failure = new KiboError("NOT_FOUND", "gone");
  emit("silo");
  await wait(GROUPING_WINDOW_MS);
  expect(store.peek("silo")).toBeNull();
  failure = null;
  expect((await store.ensure("silo")).meta.id).toBe("silo");
});

test("subscribers hear about each published view", async () => {
  const store = newStore();
  let published = 0;
  const off = store.subscribe(() => {
    published += 1;
  });
  await store.ensure("silo");
  expect(published).toBe(1);
  off();
});
