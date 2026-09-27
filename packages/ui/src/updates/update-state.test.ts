import { describe, expect, test } from "bun:test";
import {
  classifyUpdateFailure,
  downloadPercent,
  IDLE,
  reduceUpdate,
  type UpdateInfo,
  type UpdateStatus,
} from "./update-state";

const update: UpdateInfo = { version: "1.1.0", currentVersion: "1.0.0", notes: "Corrige", publishedAt: null };

describe("update state", () => {
  test("a check finds nothing or a version", () => {
    const checking = reduceUpdate(IDLE, { type: "check" });
    expect(checking).toEqual({ phase: "checking", update: null });
    expect(reduceUpdate(checking, { type: "none", at: 42 })).toEqual({ phase: "current", checkedAt: 42 });
    expect(reduceUpdate(checking, { type: "found", update })).toEqual({ phase: "available", update });
  });

  test("a failed check keeps the last known update", () => {
    const available: UpdateStatus = { phase: "available", update };
    const failed = reduceUpdate(reduceUpdate(available, { type: "check" }), {
      type: "checkFailed",
      detail: "dns",
    });
    expect(failed).toEqual({ phase: "error", step: "check", detail: "dns", update });
    expect(
      reduceUpdate(reduceUpdate(IDLE, { type: "check" }), { type: "checkFailed", detail: "dns" }),
    ).toEqual({
      phase: "error",
      step: "check",
      detail: "dns",
      update: null,
    });
  });

  test("an install downloads, then installs, then can fail without losing the update", () => {
    const downloading = reduceUpdate({ phase: "available", update }, { type: "install" });
    expect(downloading).toEqual({ phase: "downloading", update, received: 0, total: null });
    const started = reduceUpdate(downloading, { type: "started", total: 200 });
    const half = reduceUpdate(started, { type: "progress", chunk: 100 });
    expect(half).toEqual({ phase: "downloading", update, received: 100, total: 200 });
    expect(downloadPercent(half)).toBe(50);
    expect(downloadPercent(downloading)).toBeNull();
    expect(reduceUpdate(half, { type: "downloaded" })).toEqual({ phase: "installing", update });
    expect(reduceUpdate(half, { type: "installFailed", detail: "disk" })).toEqual({
      phase: "error",
      step: "install",
      detail: "disk",
      update,
    });
  });

  test("an install can be retried after a failure, and a check is ignored while busy", () => {
    const failed: UpdateStatus = { phase: "error", step: "install", detail: "disk", update };
    expect(reduceUpdate(failed, { type: "install" }).phase).toBe("downloading");
    const downloading = reduceUpdate({ phase: "available", update }, { type: "install" });
    expect(reduceUpdate(downloading, { type: "check" })).toBe(downloading);
    expect(reduceUpdate({ phase: "installing", update }, { type: "check" })).toEqual({
      phase: "installing",
      update,
    });
    expect(reduceUpdate({ phase: "current", checkedAt: 1 }, { type: "install" })).toEqual({
      phase: "current",
      checkedAt: 1,
    });
  });

  test("failures are classified for the user", () => {
    expect(classifyUpdateFailure("check", "error sending request for url")).toBe("check");
    expect(classifyUpdateFailure("install", "Cannot install update: unsupported Linux package")).toBe(
      "appImageOnly",
    );
    expect(classifyUpdateFailure("install", "AppImage path not found")).toBe("appImageOnly");
    expect(classifyUpdateFailure("install", "permission denied")).toBe("install");
  });
});
