import { describe, expect, test } from "bun:test";
import { extractExitCode, formatToolOutput } from "./tool-result-formatter";

describe("extractExitCode", () => {
	test("parses exit code from output", () => {
		expect(extractExitCode("some output\nExit code: 0")).toBe(0);
		expect(extractExitCode("error output\nExit code: 1")).toBe(1);
		expect(extractExitCode("output\nExit code: 127")).toBe(127);
	});

	test("handles exit code with surrounding whitespace", () => {
		expect(extractExitCode("output\n  Exit code: 2  ")).toBe(2);
	});

	test("falls back to isError flag when no exit code pattern", () => {
		expect(extractExitCode("no exit code here")).toBe(0);
		expect(extractExitCode("no exit code here", false)).toBe(0);
		expect(extractExitCode("no exit code here", true)).toBe(1);
	});

	test("prefers parsed exit code over isError flag", () => {
		expect(extractExitCode("Exit code: 0", true)).toBe(0);
		expect(extractExitCode("Exit code: 2", false)).toBe(2);
	});

	test("handles empty output", () => {
		expect(extractExitCode("")).toBe(0);
		expect(extractExitCode("", true)).toBe(1);
	});
});

describe("formatToolOutput", () => {
	test("returns string content as-is", () => {
		expect(formatToolOutput("hello")).toBe("hello");
		expect(formatToolOutput("")).toBe("");
	});

	test("returns empty string for null/undefined", () => {
		expect(formatToolOutput(null)).toBe("");
		expect(formatToolOutput(undefined)).toBe("");
	});

	test("JSON-stringifies objects", () => {
		expect(formatToolOutput({ key: "value" })).toBe(
			JSON.stringify({ key: "value" }, null, 2),
		);
	});

	test("JSON-stringifies arrays", () => {
		expect(formatToolOutput([1, 2, 3])).toBe(
			JSON.stringify([1, 2, 3], null, 2),
		);
	});

	test("converts numbers to string", () => {
		expect(formatToolOutput(42)).toBe("42");
	});

	test("converts booleans to string", () => {
		expect(formatToolOutput(true)).toBe("true");
		expect(formatToolOutput(false)).toBe("false");
	});
});
