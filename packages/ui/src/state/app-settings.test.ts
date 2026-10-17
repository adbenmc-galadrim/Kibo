import { expect, test } from "bun:test";
import type { AppSettings, AppSettingsPatch } from "@kibo/schema";
import { type AppSettingsSource, createAppSettingsStore, DEFAULT_APP_SETTINGS } from "./app-settings";

type FakeSource = AppSettingsSource & {
  stored: AppSettings;
  reads: number;
  writes: AppSettingsPatch[];
  emitConfig(): void;
  listeners: Set<() => void>;
};

function fakeSource(stored: AppSettings): FakeSource {
  const listeners = new Set<() => void>();
  const source: FakeSource = {
    stored,
    reads: 0,
    writes: [],
    listeners,
    getAppSettings: () => {
      source.reads += 1;
      return Promise.resolve(source.stored);
    },
    setAppSettings: (patch) => {
      source.writes.push(patch);
      source.stored = { ...source.stored, ...patch };
      return Promise.resolve(source.stored);
    },
    subscribeConfig: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emitConfig: () => {
      for (const l of listeners) l();
    },
  };
  return source;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

test("before the first read, agent execution is hidden", () => {
  const store = createAppSettingsStore(fakeSource({ agentExecution: "shown" }));
  expect(store.get()).toEqual(DEFAULT_APP_SETTINGS);
  expect(DEFAULT_APP_SETTINGS.agentExecution).toBe("hidden");
});

test("the first subscriber reads the settings from the daemon", async () => {
  const source = fakeSource({ agentExecution: "shown" });
  const store = createAppSettingsStore(source);
  let seen = 0;
  const off = store.subscribe(() => {
    seen += 1;
  });
  await flush();
  expect(source.reads).toBe(1);
  expect(store.get().agentExecution).toBe("shown");
  expect(seen).toBe(1);
  off();
});

test("a config message reloads the settings", async () => {
  const source = fakeSource({ agentExecution: "hidden" });
  const store = createAppSettingsStore(source);
  const off = store.subscribe(() => undefined);
  await flush();
  source.stored = { agentExecution: "shown" };
  source.emitConfig();
  await flush();
  expect(source.reads).toBe(2);
  expect(store.get().agentExecution).toBe("shown");
  off();
  expect(source.listeners.size).toBe(0);
});

test("an update sends the patch and keeps the daemon's answer", async () => {
  const source = fakeSource({ agentExecution: "hidden" });
  const store = createAppSettingsStore(source);
  const next = await store.update({ agentExecution: "shown" });
  expect(source.writes).toEqual([{ agentExecution: "shown" }]);
  expect(next.agentExecution).toBe("shown");
  expect(store.get().agentExecution).toBe("shown");
});

test("a failed read keeps the current settings", async () => {
  const source = fakeSource({ agentExecution: "shown" });
  source.getAppSettings = () => Promise.reject(new Error("offline"));
  const store = createAppSettingsStore(source, () => undefined);
  const off = store.subscribe(() => undefined);
  await flush();
  expect(store.get()).toEqual(DEFAULT_APP_SETTINGS);
  off();
});
