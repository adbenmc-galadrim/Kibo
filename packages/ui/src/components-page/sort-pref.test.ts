import { expect, test } from "bun:test";
import { formatSort, parseSort } from "./sort-pref";

test("a stored sort reads back; anything else falls back to Nom ascending", () => {
  expect(parseSort(formatSort({ sort: "usage", descending: true }))).toEqual({
    sort: "usage",
    descending: true,
  });
  expect(parseSort("version:asc")).toEqual({ sort: "version", descending: false });
  for (const raw of ["", "usage", "size:desc", "title:up"])
    expect(parseSort(raw)).toEqual({ sort: "title", descending: false });
});
