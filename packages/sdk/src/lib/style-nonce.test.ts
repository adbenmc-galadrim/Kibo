import { afterEach, expect, test } from "bun:test";
import { styleNonce } from "./style-nonce";

afterEach(() => {
  for (const meta of Array.from(document.head.querySelectorAll('meta[property="csp-nonce"]'))) meta.remove();
});

test("the style nonce comes from the csp-nonce meta of the page, undefined without it", () => {
  expect(styleNonce(document)).toBeUndefined();
  const meta = document.createElement("meta");
  meta.setAttribute("property", "csp-nonce");
  meta.setAttribute("content", "bm9uY2U=");
  document.head.append(meta);
  expect(styleNonce(document)).toBe("bm9uY2U=");
});
