import { expect, test } from "bun:test";
import { EMBED_ATTRIBUTES, type EmbedView } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { EmbedFrame } from "./embed-frame";

const view: EmbedView = {
  url: "about:blank#embed-1",
  kind: "game",
  sandbox: EMBED_ATTRIBUTES.game.sandbox,
  allow: EMBED_ATTRIBUTES.game.allow,
  expiresAt: 1_000,
  target: "https://itch.io/embed-upload/1",
};

test("the frame carries the view's address and attributes, never a referrer", () => {
  render(<EmbedFrame view={view} title="Jeu itch.io" now={() => 0} />);
  const frame = screen.getByTitle("Jeu itch.io");
  expect(frame.tagName).toBe("IFRAME");
  expect(frame.getAttribute("src")).toBe(view.url);
  expect(frame.getAttribute("sandbox")).toBe(view.sandbox);
  expect(frame.getAttribute("allow")).toBe(view.allow);
  expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
});

test("an expired view asks for a new one on mount, a live one never does", () => {
  const expired: string[] = [];
  const live = render(
    <EmbedFrame view={view} title="A" now={() => 999} onExpired={() => expired.push("live")} />,
  );
  live.rerender(
    <EmbedFrame view={view} title="A" now={() => 5_000} onExpired={() => expired.push("live")} />,
  );
  render(<EmbedFrame view={view} title="B" now={() => 1_000} onExpired={() => expired.push("expired")} />);
  expect(expired).toEqual(["expired"]);
});
