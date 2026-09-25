import { expect, test } from "bun:test";
import { abbreviateHome } from "./home-path";

test.each([
  ["/Users/adam/goinfre/Kibo", "~/goinfre/Kibo"],
  ["/home/adam/code/portfolio", "~/code/portfolio"],
  ["/Users/adam", "~"],
  ["/opt/kibo", "/opt/kibo"],
  ["C:\\Users\\adam\\kibo", "~\\kibo"],
])("abbreviateHome(%p) = %p", (path, short) => {
  expect(abbreviateHome(path)).toBe(short);
});
