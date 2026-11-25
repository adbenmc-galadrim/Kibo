import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../store";
import { openPushedKinds } from "./pushed-kinds";
import { openRemoteSettings } from "./settings";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

const tempHome = () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-remote-pushed-"));
  homes.push(home);
  return home;
};

test("the kinds pushed per project survive a restart of the daemon", () => {
  const home = tempHome();
  const store = openStore(home);
  const pushed = openPushedKinds(store);
  pushed.add("silo", "project");
  pushed.add("silo", "image:q1:i1");
  pushed.add("atelier", "project");
  pushed.remove("silo", "project");
  store.close();
  const again = openStore(home);
  const reopened = openPushedKinds(again);
  expect(reopened.kinds("silo")).toEqual(["image:q1:i1"]);
  expect(reopened.projects().sort()).toEqual(["atelier", "silo"]);
  reopened.forget("atelier");
  expect(reopened.projects()).toEqual(["silo"]);
  again.close();
});

test("clearing the remote settings forgets the pushed kinds", () => {
  const store = openStore(tempHome());
  openPushedKinds(store).add("silo", "project");
  openRemoteSettings(store).clear();
  expect(openPushedKinds(store).projects()).toEqual([]);
  store.close();
});
