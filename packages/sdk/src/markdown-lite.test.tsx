import { expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { renderMarkdownLite } from "./markdown-lite";

test("ticket keys become buttons when a handler is given, outside inline code", () => {
  const opened: string[] = [];
  const { container } = render(
    <div>
      {renderMarkdownLite("**SILO-11** puis SILO-2, pas `SILO-3` ni AB-", {
        onTicket: (k) => opened.push(k),
      })}
    </div>,
  );
  const buttons = Array.from(container.querySelectorAll("button"));
  expect(buttons.map((b) => b.textContent)).toEqual(["SILO-11", "SILO-2"]);
  expect(container.querySelector("strong > button")?.textContent).toBe("SILO-11");
  for (const b of buttons) fireEvent.click(b);
  expect(opened).toEqual(["SILO-11", "SILO-2"]);
  expect(container.textContent).toBe("SILO-11 puis SILO-2, pas SILO-3 ni AB-");
});

test("without a handler keys stay text and raw HTML never becomes a node", () => {
  const { container } = render(<div>{renderMarkdownLite("SILO-11 <script>alert(1)</script>")}</div>);
  expect(container.querySelector("button")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
  expect(container.textContent).toBe("SILO-11 <script>alert(1)</script>");
});
