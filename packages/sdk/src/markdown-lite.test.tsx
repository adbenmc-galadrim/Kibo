import { expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { renderMarkdownLite } from "./markdown-lite";

test("ticket keys become buttons when a handler is given, outside inline code", () => {
  const opened: string[] = [];
  const { container } = render(
    <div>
      {renderMarkdownLite("**EMIS-11** puis EMIS-2, pas `EMIS-3` ni AB-", {
        onTicket: (k) => opened.push(k),
      })}
    </div>,
  );
  const buttons = Array.from(container.querySelectorAll("button"));
  expect(buttons.map((b) => b.textContent)).toEqual(["EMIS-11", "EMIS-2"]);
  expect(container.querySelector("strong > button")?.textContent).toBe("EMIS-11");
  for (const b of buttons) fireEvent.click(b);
  expect(opened).toEqual(["EMIS-11", "EMIS-2"]);
  expect(container.textContent).toBe("EMIS-11 puis EMIS-2, pas EMIS-3 ni AB-");
});

test("without a handler keys stay text and raw HTML never becomes a node", () => {
  const { container } = render(<div>{renderMarkdownLite("EMIS-11 <script>alert(1)</script>")}</div>);
  expect(container.querySelector("button")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
  expect(container.textContent).toBe("EMIS-11 <script>alert(1)</script>");
});
