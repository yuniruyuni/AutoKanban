import { describe, expect, test } from "vitest";
import { parseDbLogs } from "./log-parser";

describe("parseDbLogs", () => {
	test("parses single stdout line", () => {
		const result = parseDbLogs(
			"[2024-01-01T12:00:00.000Z] [stdout] hello world",
		);
		expect(result).toEqual([
			{
				timestamp: "2024-01-01T12:00:00.000Z",
				source: "stdout",
				data: "hello world",
			},
		]);
	});

	test("parses single stderr line", () => {
		const result = parseDbLogs(
			"[2024-01-01T12:00:00.000Z] [stderr] error occurred",
		);
		expect(result).toEqual([
			{
				timestamp: "2024-01-01T12:00:00.000Z",
				source: "stderr",
				data: "error occurred",
			},
		]);
	});

	test("parses multiple lines", () => {
		const input = [
			"[2024-01-01T12:00:00.000Z] [stdout] line 1",
			"[2024-01-01T12:00:01.000Z] [stderr] line 2",
		].join("\n");
		const result = parseDbLogs(input);
		expect(result).toHaveLength(2);
		expect(result[0].source).toBe("stdout");
		expect(result[1].source).toBe("stderr");
	});

	test("skips empty lines", () => {
		const input = "[2024-01-01T12:00:00.000Z] [stdout] data\n\n\n";
		const result = parseDbLogs(input);
		expect(result).toHaveLength(1);
	});

	test("skips lines that do not match format", () => {
		const input =
			"not a valid log line\n[2024-01-01T12:00:00.000Z] [stdout] valid";
		const result = parseDbLogs(input);
		expect(result).toHaveLength(1);
		expect(result[0].data).toBe("valid");
	});

	test("returns empty array for empty string", () => {
		expect(parseDbLogs("")).toEqual([]);
	});

	test("handles data containing brackets", () => {
		const result = parseDbLogs(
			"[2024-01-01T12:00:00.000Z] [stdout] array [1, 2, 3] done",
		);
		expect(result).toHaveLength(1);
		expect(result[0].data).toBe("array [1, 2, 3] done");
	});

	test("returns empty array for whitespace-only input", () => {
		expect(parseDbLogs("   \n  \n  ")).toEqual([]);
	});
});
