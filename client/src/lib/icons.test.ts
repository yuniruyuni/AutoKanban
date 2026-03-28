import {
	Code,
	FileCode,
	FolderOpen,
	Globe,
	Terminal,
	Wrench,
} from "lucide-react";
import { describe, expect, test } from "vitest";
import { AVAILABLE_ICON_NAMES, getIconComponent } from "./icons";

describe("getIconComponent", () => {
	test('returns Code for "code"', () => {
		expect(getIconComponent("code")).toBe(Code);
	});

	test('returns Terminal for "terminal"', () => {
		expect(getIconComponent("terminal")).toBe(Terminal);
	});

	test('returns FolderOpen for "folder-open"', () => {
		expect(getIconComponent("folder-open")).toBe(FolderOpen);
	});

	test('returns FileCode for "file-code"', () => {
		expect(getIconComponent("file-code")).toBe(FileCode);
	});

	test('returns Globe for "globe"', () => {
		expect(getIconComponent("globe")).toBe(Globe);
	});

	test('returns Wrench for "wrench"', () => {
		expect(getIconComponent("wrench")).toBe(Wrench);
	});

	test("returns null for unknown icon name", () => {
		expect(getIconComponent("nonexistent")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(getIconComponent("")).toBeNull();
	});
});

describe("AVAILABLE_ICON_NAMES", () => {
	test("contains all 6 icon names", () => {
		expect(AVAILABLE_ICON_NAMES).toHaveLength(6);
	});

	test("includes all expected names", () => {
		expect(AVAILABLE_ICON_NAMES).toContain("code");
		expect(AVAILABLE_ICON_NAMES).toContain("terminal");
		expect(AVAILABLE_ICON_NAMES).toContain("folder-open");
		expect(AVAILABLE_ICON_NAMES).toContain("file-code");
		expect(AVAILABLE_ICON_NAMES).toContain("globe");
		expect(AVAILABLE_ICON_NAMES).toContain("wrench");
	});
});
