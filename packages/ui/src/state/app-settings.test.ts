import { expect, test } from "bun:test";
import type { AppSettings, AppSettingsPatch } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import { type AppSettingsSource, createAppSettingsStore, DEFAULT_APP_SETTINGS } from "./app-settings";
import { useAppSettings } from "./use-app-settings";

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

test("before the first read, the store holds the empty defaults", () => {
  const store = createAppSettingsStore(fakeSource({}));
  expect(store.get()).toEqual(DEFAULT_APP_SETTINGS);
  expect(DEFAULT_APP_SETTINGS).toEqual({});
});

test("the first subscriber reads the settings from the daemon", async () => {
  const source = fakeSource({});
  const store = createAppSettingsStore(source);
  let seen = 0;
  const off = store.subscribe(() => {
    seen += 1;
  });
  await flush();
  expect(source.reads).toBe(1);
  expect(store.get()).toBe(source.stored);
  expect(seen).toBe(1);
  off();
});

test("a config message reloads the settings", async () => {
  const source = fakeSource({});
  const store = createAppSettingsStore(source);
  const off = store.subscribe(() => undefined);
  await flush();
  source.stored = {};
  source.emitConfig();
  await flush();
  expect(source.reads).toBe(2);
  expect(store.get()).toBe(source.stored);
  off();
  expect(source.listeners.size).toBe(0);
});

test("an update sends the patch and keeps the daemon's answer", async () => {
  const source = fakeSource({});
  const store = createAppSettingsStore(source);
  const next = await store.update({});
  expect(source.writes).toEqual([{}]);
  expect(next).toBe(source.stored);
  expect(store.get()).toBe(source.stored);
});

test("a failed read keeps the current settings", async () => {
  const source = fakeSource({});
  source.getAppSettings = () => Promise.reject(new Error("offline"));
  const store = createAppSettingsStore(source, () => undefined);
  const off = store.subscribe(() => undefined);
  await flush();
  expect(store.get()).toBe(DEFAULT_APP_SETTINGS);
  off();
});

test("without a provider, the settings are empty", () => {
  expect(renderHook(() => useAppSettings()).result.current).toEqual({});
});
