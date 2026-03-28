import { describe, expect, test } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	test("combines class names", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	test("resolves Tailwind conflicts (last wins)", () => {
		expect(cn("p-2", "p-4")).toBe("p-4");
	});

	test("excludes falsy values", () => {
		expect(cn("foo", false && "bar", null, undefined, "baz")).toBe("foo baz");
	});

	test("returns empty string for no input", () => {
		expect(cn()).toBe("");
	});

	test("handles conditional classes", () => {
		const isActive = true;
		expect(cn("base", isActive && "active")).toBe("base active");
	});
});
