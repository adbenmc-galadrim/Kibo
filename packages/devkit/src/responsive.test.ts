import { expect, test } from "bun:test";
import { responsiveViolations } from "./responsive";

const advice = "utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)";

test("responsiveViolations flags fixed widths of 240px and more, in classes and styles", () => {
  expect(responsiveViolations('<div className="w-[480px] min-w-[300px] max-w-[200px]">')).toEqual([
    "ui.tsx : largeur fixe w-[480px] ; utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)",
    "ui.tsx : largeur fixe min-w-[300px] ; utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)",
  ]);
  expect(responsiveViolations('style={{ width: "640px" }}', "ui.tsx")).toHaveLength(1);
  expect(responsiveViolations('<div className="w-full md:w-1/2 @lg:w-[200px]">')).toEqual([]);
});

test("variants, important marks, decimals and every width property are caught", () => {
  expect(
    responsiveViolations(
      'cn("@md:w-[512px]", "!max-w-[960px]", "w-[240px]!", "w-[239px]", "w-[250.5px]", "tw-[900px]")',
      "parts.tsx",
    ),
  ).toEqual([
    `parts.tsx : largeur fixe w-[512px] ; ${advice}`,
    `parts.tsx : largeur fixe max-w-[960px] ; ${advice}`,
    `parts.tsx : largeur fixe w-[240px] ; ${advice}`,
    `parts.tsx : largeur fixe w-[250.5px] ; ${advice}`,
  ]);
  expect(
    responsiveViolations(
      "style={{ minWidth: '320px', maxWidth: `1024px`, height: '600px' }} css='width:300px'",
    ),
  ).toEqual([
    `ui.tsx : largeur fixe minWidth: 320px ; ${advice}`,
    `ui.tsx : largeur fixe maxWidth: 1024px ; ${advice}`,
    `ui.tsx : largeur fixe width: 300px ; ${advice}`,
  ]);
});

test("relative widths, heights and small fixed widths are accepted", () => {
  expect(
    responsiveViolations(
      'className="h-[480px] w-[20rem] w-[50%] min-h-[600px]" style={{ width: "100%", lineHeight: "300px" }}',
    ),
  ).toEqual([]);
});
