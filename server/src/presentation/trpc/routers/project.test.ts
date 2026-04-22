import { describe, expect, it } from "bun:test";
import { projectNameSchema } from "./project";

describe("projectNameSchema", () => {
	it("accepts plain ASCII names", () => {
		expect(projectNameSchema.safeParse("my-project").success).toBe(true);
	});

	it("accepts Japanese names", () => {
		expect(projectNameSchema.safeParse("自動カンバン").success).toBe(true);
	});

	it("rejects names containing forward slashes", () => {
		expect(projectNameSchema.safeParse("foo/bar").success).toBe(false);
	});

	it("rejects names containing backslashes", () => {
		expect(projectNameSchema.safeParse("foo\\bar").success).toBe(false);
	});

	it("rejects names containing null bytes", () => {
		expect(projectNameSchema.safeParse("foo\0bar").success).toBe(false);
	});

	it("rejects '..'", () => {
		expect(projectNameSchema.safeParse("..").success).toBe(false);
	});

	it("rejects names starting with '.'", () => {
		expect(projectNameSchema.safeParse(".hidden").success).toBe(false);
	});

	it("rejects names with leading whitespace", () => {
		expect(projectNameSchema.safeParse(" leading").success).toBe(false);
	});

	it("rejects names with trailing whitespace", () => {
		expect(projectNameSchema.safeParse("trailing ").success).toBe(false);
	});

	it("rejects empty string", () => {
		expect(projectNameSchema.safeParse("").success).toBe(false);
	});

	it("rejects names exceeding 100 chars", () => {
		expect(projectNameSchema.safeParse("a".repeat(101)).success).toBe(false);
	});
});
