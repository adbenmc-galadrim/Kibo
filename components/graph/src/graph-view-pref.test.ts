import { afterEach, expect, test } from "bun:test";
import { readView, viewKey, writeView } from "./graph-view-pref";

const getItem = Storage.prototype.getItem;
const setItem = Storage.prototype.setItem;

afterEach(() => {
  Storage.prototype.getItem = getItem;
  Storage.prototype.setItem = setItem;
  localStorage.clear();
});

test("the key is per instance", () => {
  expect(viewKey("i1")).toBe("kibo.graph.view.i1");
});

test("« Fonctionnalités » by default, the stored view otherwise, per instance", () => {
  expect(readView("i1")).toBe("features");
  writeView("i1", "prs");
  expect(localStorage.getItem("kibo.graph.view.i1")).toBe("prs");
  expect(readView("i1")).toBe("prs");
  expect(readView("i2")).toBe("features");
  writeView("i1", "features");
  expect(readView("i1")).toBe("features");
});

test("an unknown stored value reads as « Fonctionnalités »", () => {
  localStorage.setItem("kibo.graph.view.i1", "waves");
  expect(readView("i1")).toBe("features");
});

test("a storage that throws keeps « Fonctionnalités » and never breaks a write", () => {
  Storage.prototype.getItem = () => {
    throw new Error("denied");
  };
  Storage.prototype.setItem = () => {
    throw new Error("denied");
  };
  expect(readView("i1")).toBe("features");
  expect(() => writeView("i1", "prs")).not.toThrow();
});
