import { expect, test } from "bun:test";
import { responsiveViolations } from "./responsive";

const advice = "utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)";
const fixed = (token: string, file = "ui.tsx") => `${file} : largeur fixe ${token} ; ${advice}`;

test("responsiveViolations flags fixed widths of 240px and more, in classes and styles", () => {
  expect(responsiveViolations('<div className="w-[480px] min-w-[300px] max-w-[200px]">')).toEqual([
    "ui.tsx : largeur fixe w-[480px] ; utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)",
    "ui.tsx : largeur fixe min-w-[300px] ; utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)",
  ]);
  expect(responsiveViolations('style={{ width: "640px" }}', "ui.tsx")).toHaveLength(1);
  expect(responsiveViolations('<div className="w-full md:w-1/2 @lg:w-[200px]">')).toEqual([]);
});

test("width, min-width and size classes are fixed widths, with viewport variants, important marks and decimals", () => {
  expect(
    responsiveViolations(
      'cn("size-[300px]", "md:w-[512px]", "hover:min-w-[640px]", "w-[240px]!", "!w-[250.5px]", "w-[239px]", "tw-[900px]")',
      "parts.tsx",
    ),
  ).toEqual([
    fixed("size-[300px]", "parts.tsx"),
    fixed("md:w-[512px]", "parts.tsx"),
    fixed("hover:min-w-[640px]", "parts.tsx"),
    fixed("w-[240px]", "parts.tsx"),
    fixed("w-[250.5px]", "parts.tsx"),
  ]);
});

test("maxima and container variants are not fixed widths", () => {
  expect(
    responsiveViolations(
      'className="max-w-[960px] @lg:w-[320px] @md:min-w-[480px] @[600px]:size-[300px] @lg:hover:w-[400px]"',
    ),
  ).toEqual([]);
});

test("width and min-width declarations in arbitrary properties and style strings are fixed widths", () => {
  expect(
    responsiveViolations(
      "className=\"[width:480px] [min-width:300px] [max-width:900px]\" css='width:300px' style={{ minWidth: '320px', maxWidth: `1024px`, height: '600px' }}",
    ),
  ).toEqual([
    fixed("width: 480px"),
    fixed("min-width: 300px"),
    fixed("width: 300px"),
    fixed("minWidth: 320px"),
  ]);
});

test("unitless widths are fixed only inside an inline style", () => {
  expect(
    responsiveViolations(
      "<div style={{ width: 640, minWidth: 300, maxWidth: 900, height: 400 }} /><svg {...{ width: 640, height: 200 }} />",
    ),
  ).toEqual([fixed("width: 640"), fixed("minWidth: 300")]);
  expect(responsiveViolations("const box = { width: 640, height: 200 };\n<svg width={640} />")).toEqual([]);
  expect(responsiveViolations("<div style={{ width: 200, minWidth: 0 }} />")).toEqual([]);
});

test("query conditions are not fixed widths", () => {
  expect(
    responsiveViolations(
      'const q = "(min-width: 640px)"; const c = "@container (min-width: 480px)"; <img sizes="(min-width: 640px) 50vw" />; matchMedia("( width: 900px )")',
    ),
  ).toEqual([]);
});

test("relative widths, heights, scale classes and rem are accepted", () => {
  expect(
    responsiveViolations(
      'className="h-[480px] w-[20rem] w-[50%] w-96 min-h-[600px]" style={{ width: "100%", lineHeight: "300px" }}',
    ),
  ).toEqual([]);
});
