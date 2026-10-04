import { expect, test } from "bun:test";
import { NO_PERMISSIONS, permissionList, permissionOfCall } from "./permissions";

test("design.frame needs the design capability", () => {
  expect(
    permissionOfCall({
      kind: "design.frame",
      url: "https://www.figma.com/design/AbC123xyz/K?node-id=1-2",
      refresh: false,
    }),
  ).toBe("cap:design");
  expect(permissionList({ ...NO_PERMISSIONS, capabilities: ["design"] })).toEqual(["cap:design"]);
});
