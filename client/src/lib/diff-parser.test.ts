import { describe, expect, test } from "vitest";
import type { GitDiff } from "@/hooks/useGit";
import {
	buildFileTree,
	filterWhitespaceHunks,
	isWhitespaceOnlyChange,
	pairSideBySide,
	parseDiffLines,
} from "./diff-parser";

describe("buildFileTree", () => {
	test("empty array returns empty root", () => {
		const tree = buildFileTree([]);
		expect(tree.children.size).toBe(0);
		expect(tree.isFile).toBe(false);
	});

	test("single file at root", () => {
		const diffs: GitDiff[] = [
			{ filePath: "README.md", status: "modified", additions: 1, deletions: 0 },
		];
		const tree = buildFileTree(diffs);
		expect(tree.children.size).toBe(1);
		const readme = tree.children.get("README.md");
		expect(readme?.isFile).toBe(true);
		expect(readme?.path).toBe("README.md");
	});

	test("nested file creates directory nodes", () => {
		const diffs: GitDiff[] = [
			{
				filePath: "src/lib/utils.ts",
				status: "added",
				additions: 10,
				deletions: 0,
			},
		];
		const tree = buildFileTree(diffs);
		const src = tree.children.get("src");
		expect(src?.isFile).toBe(false);
		expect(src?.path).toBe("src");

		const lib = src?.children.get("lib");
		expect(lib?.isFile).toBe(false);
		expect(lib?.path).toBe("src/lib");

		const utils = lib?.children.get("utils.ts");
		expect(utils?.isFile).toBe(true);
		expect(utils?.path).toBe("src/lib/utils.ts");
	});

	test("multiple files share directory nodes", () => {
		const diffs: GitDiff[] = [
			{ filePath: "src/a.ts", status: "modified", additions: 1, deletions: 1 },
			{ filePath: "src/b.ts", status: "added", additions: 5, deletions: 0 },
		];
		const tree = buildFileTree(diffs);
		const src = tree.children.get("src");
		expect(src?.children.size).toBe(2);
	});
});

describe("parseDiffLines", () => {
	test("parses hunk header with line numbers", () => {
		const diff = "@@ -1,3 +1,4 @@\n context\n+addition\n-deletion";
		const lines = parseDiffLines(diff);

		expect(lines[0]).toEqual({ type: "hunk", content: "@@ -1,3 +1,4 @@" });
		expect(lines[1]).toEqual({
			type: "context",
			content: " context",
			oldLineNum: 1,
			newLineNum: 1,
		});
		expect(lines[2]).toEqual({
			type: "addition",
			content: "+addition",
			newLineNum: 2,
		});
		expect(lines[3]).toEqual({
			type: "deletion",
			content: "-deletion",
			oldLineNum: 2,
		});
	});

	test("skips diff metadata lines", () => {
		const diff =
			"diff --git a/file b/file\nindex abc..def\n--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new";
		const lines = parseDiffLines(diff);

		expect(lines[0].type).toBe("hunk");
		expect(lines[1]).toEqual({
			type: "deletion",
			content: "-old",
			oldLineNum: 1,
		});
		expect(lines[2]).toEqual({
			type: "addition",
			content: "+new",
			newLineNum: 1,
		});
	});

	test("empty input returns empty array", () => {
		expect(parseDiffLines("")).toEqual([
			{ type: "context", content: "", oldLineNum: 1, newLineNum: 1 },
		]);
	});
});

describe("pairSideBySide", () => {
	test("context lines paired with themselves", () => {
		const lines = parseDiffLines("@@ -1 +1 @@\n context");
		const pairs = pairSideBySide(lines);

		expect(pairs[1].left).toEqual(pairs[1].right);
	});

	test("deletion + addition paired together", () => {
		const lines = parseDiffLines("@@ -1 +1 @@\n-old\n+new");
		const pairs = pairSideBySide(lines);

		expect(pairs[1].left?.type).toBe("deletion");
		expect(pairs[1].right?.type).toBe("addition");
	});

	test("unbalanced: more deletions than additions pads right with null", () => {
		const lines = parseDiffLines("@@ -1 +1 @@\n-a\n-b\n+c");
		const pairs = pairSideBySide(lines);

		// pairs[0] is hunk
		expect(pairs[1].left?.content).toBe("-a");
		expect(pairs[1].right?.content).toBe("+c");
		expect(pairs[2].left?.content).toBe("-b");
		expect(pairs[2].right).toBeNull();
	});

	test("unbalanced: more additions than deletions pads left with null", () => {
		const lines = parseDiffLines("@@ -1 +1 @@\n-a\n+b\n+c");
		const pairs = pairSideBySide(lines);

		expect(pairs[1].left?.content).toBe("-a");
		expect(pairs[1].right?.content).toBe("+b");
		expect(pairs[2].left).toBeNull();
		expect(pairs[2].right?.content).toBe("+c");
	});
});

describe("isWhitespaceOnlyChange", () => {
	test("whitespace-only content returns true", () => {
		expect(isWhitespaceOnlyChange("+  ")).toBe(true);
		expect(isWhitespaceOnlyChange("-\t")).toBe(true);
		expect(isWhitespaceOnlyChange("+")).toBe(true);
	});

	test("non-whitespace content returns false", () => {
		expect(isWhitespaceOnlyChange("+code")).toBe(false);
		expect(isWhitespaceOnlyChange("-  code  ")).toBe(false);
	});
});

describe("filterWhitespaceHunks", () => {
	test("removes hunks with only whitespace changes", () => {
		const diff = [
			"diff --git a/file b/file",
			"--- a/file",
			"+++ b/file",
			"@@ -1,2 +1,2 @@",
			"-  ",
			"+    ",
		].join("\n");
		const result = filterWhitespaceHunks(diff);

		expect(result).not.toContain("@@");
		expect(result).toContain("diff --git a/file b/file");
	});

	test("keeps hunks with real changes", () => {
		const diff = [
			"diff --git a/file b/file",
			"--- a/file",
			"+++ b/file",
			"@@ -1,2 +1,2 @@",
			"-old code",
			"+new code",
		].join("\n");
		const result = filterWhitespaceHunks(diff);

		expect(result).toContain("@@ -1,2 +1,2 @@");
		expect(result).toContain("-old code");
		expect(result).toContain("+new code");
	});
});
