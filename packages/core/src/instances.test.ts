import { expect, test } from "bun:test";
import { createProjectDoc, listInstances } from "./index";

test("instances stored before v1.0 are listed with componentHash null", () => {
  const doc = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#3B82F6" });
  doc.getMap("instances").set("i1", {
    id: "i1",
    pageId: "pg1",
    component: "burndown@0.3.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  });
  expect(listInstances(doc)[0]?.componentHash).toBeNull();
});
