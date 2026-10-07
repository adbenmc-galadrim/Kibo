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

  test("an install backs up first, and a failed backup keeps the update", () => {
    const backingUp = reduceUpdate({ phase: "available", update }, { type: "install" });
    expect(backingUp).toEqual({ phase: "backingUp", update });
    expect(reduceUpdate(backingUp, { type: "check" })).toBe(backingUp);
    expect(reduceUpdate(backingUp, { type: "install" })).toBe(backingUp);
    expect(reduceUpdate(backingUp, { type: "backupFailed", detail: "CONFLICT" })).toEqual({
      phase: "error",
      step: "backup",
      detail: "CONFLICT",
      update,
    });
    expect(reduceUpdate({ phase: "available", update }, { type: "backedUp" })).toEqual({
      phase: "available",
      update,
    });
  });

  test("an install downloads, then installs, then can fail without losing the update", () => {
    const downloading = reduceUpdate(reduceUpdate({ phase: "available", update }, { type: "install" }), {
      type: "backedUp",
    });
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
    expect(reduceUpdate(failed, { type: "install" }).phase).toBe("backingUp");
    const downloading = reduceUpdate(reduceUpdate({ phase: "available", update }, { type: "install" }), {
      type: "backedUp",
    });
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
    expect(classifyUpdateFailure("backup", "AppImage")).toBe("backup");
  });

  test("a channel without release, an invalid manifest and a bad signature are told apart from the network", () => {
    expect(classifyUpdateFailure("check", "Could not fetch a valid release JSON from the remote")).toBe(
      "noRelease",
    );
    for (const detail of [
      "missing field `version` at line 1 column 2",
      "expected value at line 1 column 1",
      "the platform `darwin-aarch64` was not found in the response `platforms` object",
      'None of the fallback platforms `["linux-x86_64"]` were found in the response `platforms` object',
    ])
      expect(classifyUpdateFailure("check", detail)).toBe("invalid");
    for (const detail of [
      "The signature abc could not be decoded, please check if it is a valid base64 string.",
      "Invalid signature",
      "invalid public key",
      "Invalid symbol 45, offset 3.",
    ])
      expect(classifyUpdateFailure("install", detail)).toBe("invalid");
    expect(classifyUpdateFailure("check", "error sending request for url (https://github.com/x)")).toBe(
      "check",
    );
  });
});
