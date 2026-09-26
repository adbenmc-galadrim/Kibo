import { expect, test } from "bun:test";
import { bitString, concat, explicit, integer, ipBytes, oid, sequence, time, tlv, utf8String } from "./der";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

test("short and long lengths", () => {
  expect(hex(tlv(0x04, new Uint8Array(3)))).toBe("0403000000");
  expect(hex(tlv(0x04, new Uint8Array(200))).slice(0, 6)).toBe("0481c8");
  expect(hex(tlv(0x04, new Uint8Array(300))).slice(0, 8)).toBe("0482012c");
});

test("integers are minimal and positive", () => {
  expect(hex(integer(new Uint8Array([2])))).toBe("020102");
  expect(hex(integer(new Uint8Array([0, 0, 5])))).toBe("020105");
  expect(hex(integer(new Uint8Array([0x80])))).toBe("02020080");
  expect(hex(integer(new Uint8Array([0])))).toBe("020100");
});

test("object identifiers", () => {
  expect(hex(oid("1.2.840.10045.4.3.2"))).toBe("06082a8648ce3d040302");
  expect(hex(oid("2.5.4.3"))).toBe("0603550403");
});

test("strings, sequences and context tags", () => {
  expect(hex(utf8String("Kibo"))).toBe("0c044b69626f");
  expect(hex(sequence(integer(new Uint8Array([1]))))).toBe("3003020101");
  expect(hex(explicit(0, integer(new Uint8Array([2]))))).toBe("a003020102");
  expect(hex(bitString(new Uint8Array([0xff])))).toBe("030200ff");
  expect(concat(new Uint8Array([1]), new Uint8Array([2, 3]))).toEqual(new Uint8Array([1, 2, 3]));
});

test("UTCTime before 2050, GeneralizedTime after", () => {
  expect(new TextDecoder().decode(time(new Date("2026-09-26T10:20:30Z")).slice(2))).toBe("260926102030Z");
  expect(time(new Date("2026-09-26T10:20:30Z"))[0]).toBe(0x17);
  expect(new TextDecoder().decode(time(new Date("2051-01-02T03:04:05Z")).slice(2))).toBe("20510102030405Z");
  expect(time(new Date("2051-01-02T03:04:05Z"))[0]).toBe(0x18);
});

test("UTCTime only from 1950 to 2049", () => {
  expect(time(new Date("1950-01-01T00:00:00Z"))[0]).toBe(0x17);
  expect(time(new Date("2049-12-31T23:59:59Z"))[0]).toBe(0x17);
  expect(time(new Date("2050-01-01T00:00:00Z"))[0]).toBe(0x18);
  expect(time(new Date("1949-12-31T23:59:59Z"))[0]).toBe(0x18);
  expect(new TextDecoder().decode(time(new Date("1949-12-31T23:59:59Z")).slice(2))).toBe("19491231235959Z");
});

test("IP addresses", () => {
  expect(ipBytes("127.0.0.1")).toEqual(new Uint8Array([127, 0, 0, 1]));
  expect(ipBytes("::1")).toEqual(new Uint8Array([...new Array(15).fill(0), 1]));
  expect(ipBytes("fe80::1:2")).toEqual(new Uint8Array([0xfe, 0x80, ...new Array(10).fill(0), 0, 1, 0, 2]));
  expect(() => ipBytes("300.1.1.1")).toThrow("INVALID_INPUT");
  expect(() => ipBytes("localhost")).toThrow("INVALID_INPUT");
  expect(() => ipBytes("1::2::3")).toThrow("INVALID_INPUT");
  expect(() => ipBytes("1:2:3")).toThrow("INVALID_INPUT");
  expect(() => ipBytes("1:2:3:4:5:6:7:8::")).toThrow("INVALID_INPUT");
  expect(() => ipBytes("1:::2")).toThrow("INVALID_INPUT");
});
