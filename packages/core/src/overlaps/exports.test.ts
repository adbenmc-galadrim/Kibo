import { describe, expect, test } from "bun:test";
import { DUPLICATION_GENERIC_EXPORTS } from "@kibo/schema";
import { exportsOf } from "./exports";

const of = (line: string) => exportsOf([line], DUPLICATION_GENERIC_EXPORTS);

describe("exportsOf", () => {
  test.each([
    ["export function formatDate(d: Date) {", ["formatDate"]],
    ["export async function* generator() {", ["generator"]],
    ["export class Formatter {", ["Formatter"]],
    ["export abstract class BaseClient {", ["BaseClient"]],
    ["export const alpha = 1;", ["alpha"]],
    ["export let bravo;", ["bravo"]],
    ["export var charlie = 2;", ["charlie"]],
    ["export enum Color {", ["Color"]],
    ["export const enum Shade {", ["Shade"]],
    ["export type Tone = string;", ["Tone"]],
    ["export interface Shape {", ["Shape"]],
    ["export namespace Tools {", ["Tools"]],
    ["export declare function declared(): void;", ["declared"]],
    ["export default function main() {", []],
    ["export default class Widget {", ["Widget"]],
    ["export default () => {};", []],
    ["export { a, b as c, d as default };", []],
    ["export { format as formatDate, type Options, parse };", ["formatDate", "Options", "parse"]],
    ["module.exports.helper = () => 1;", ["helper"]],
    ["exports.helper2 = 2;", ["helper2"]],
    ["export const Props = {};", []],
    ["export const abc = 1;", []],
    ["export const GET = () => {};", []],
    ["export { formatDate } from './format';", []],
    ["const local = 1;", []],
  ] as const)("%p", (line, expected) => {
    expect(of(line)).toEqual([...expected]);
  });

  test("dedupes names in order", () => {
    expect(exportsOf(["export const alpha = 1;", "exports.beta1 = 2;", "export { alpha };"], [])).toEqual([
      "alpha",
      "beta1",
    ]);
  });

  test("uses the given generic names", () => {
    expect(exportsOf(["export const formatDate = 1;"], ["formatDate"])).toEqual([]);
  });
});
