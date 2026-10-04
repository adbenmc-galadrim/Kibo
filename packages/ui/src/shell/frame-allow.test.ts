import { expect, test } from "bun:test";
import { allowAttribute } from "./frame-allow";

test("the allow attribute is strict by default and opens only what a capability grants", () => {
  expect(allowAttribute([])).toBe(
    "autoplay 'none'; gamepad 'none'; fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'",
  );
  expect(allowAttribute(["audio", "gamepad", "webgl"])).toBe(
    "autoplay *; gamepad *; fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'",
  );
  expect(allowAttribute(["fullscreen", "assets"])).toBe(allowAttribute([]));
});
