import { afterEach, expect, test } from "bun:test";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kibo/sdk/ui/dialog";
import { cleanup, render, screen } from "@testing-library/react";
import { applyCspNonce, readCspNonce } from "./csp-nonce";

afterEach(() => {
  cleanup();
  for (const meta of document.head.querySelectorAll('meta[property="csp-nonce"]')) meta.remove();
});

const putMeta = (content: string) => {
  const meta = document.createElement("meta");
  meta.setAttribute("property", "csp-nonce");
  meta.setAttribute("content", content);
  document.head.append(meta);
};

test("the nonce is read from the meta tag of the served page", () => {
  expect(readCspNonce(document)).toBeNull();
  putMeta("bm9uY2UtMTIzNDU2Nzg5MA==");
  expect(readCspNonce(document)).toBe("bm9uY2UtMTIzNDU2Nzg5MA==");
});

test("without a meta tag no nonce is lent", () => {
  const lent: string[] = [];
  applyCspNonce(document, (nonce) => lent.push(nonce));
  expect(lent).toEqual([]);
});

test("the style a dialog injects to lock the scroll carries the page nonce", async () => {
  putMeta("ZGlhbG9nLW5vbmNlLTEyMzQ=");
  applyCspNonce(document);
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Titre</DialogTitle>
        <DialogDescription>Texte</DialogDescription>
      </DialogContent>
    </Dialog>,
  );
  await screen.findByRole("dialog");
  const styles = [...document.head.querySelectorAll("style")];
  expect(styles.length).toBeGreaterThan(0);
  for (const style of styles) expect(style.getAttribute("nonce")).toBe("ZGlhbG9nLW5vbmNlLTEyMzQ=");
});
