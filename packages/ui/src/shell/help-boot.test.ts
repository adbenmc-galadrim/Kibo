import { beforeEach, expect, spyOn, test } from "bun:test";
import type { AppInfo } from "@kibo/schema";
import { WHATS_NEW_KEY } from "../whats-new/whats-new";
import { createHelpBoot } from "./help-boot";
import type { HelpDialog } from "./help-dialogs";

const info: AppInfo = {
  version: "1.5.0",
  platform: "linux",
  arch: "x64",
  home: "~/.kibo",
  daemonPid: 1,
  uptimeMs: 0,
};
const flush = () => new Promise((r) => setTimeout(r, 0));

function deps(appInfo: () => Promise<AppInfo> = () => Promise.resolve(info)) {
  const about: (() => void)[] = [];
  let reads = 0;
  return {
    about,
    reads: () => reads,
    boot: createHelpBoot({
      listenAbout: (onAbout) => about.push(onAbout),
      appInfo: () => {
        reads++;
        return appInfo();
      },
    }),
  };
}

beforeEach(() => localStorage.clear());

test("starting twice listens and reads once, and the native about opens the latest handler", async () => {
  const d = deps();
  const first: HelpDialog[] = [];
  const second: HelpDialog[] = [];
  d.boot((k) => first.push(k));
  d.boot((k) => second.push(k));
  await flush();
  expect(d.reads()).toBe(1);
  expect(d.about).toHaveLength(1);
  d.about[0]?.();
  expect(first).toEqual([]);
  expect(second).toEqual(["about"]);
});

test("after an upgrade the what's new dialog opens by itself", async () => {
  localStorage.setItem(WHATS_NEW_KEY, "1.4.0");
  const d = deps();
  const opened: HelpDialog[] = [];
  d.boot((k) => opened.push(k));
  await flush();
  expect(opened).toEqual(["whatsNew"]);
});

test("an unreachable daemon is logged and opens nothing", async () => {
  const error = spyOn(console, "error").mockImplementation(() => {});
  const d = deps(() => Promise.reject(new Error("offline")));
  const opened: HelpDialog[] = [];
  d.boot((k) => opened.push(k));
  await flush();
  expect(opened).toEqual([]);
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});
