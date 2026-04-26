import { describe, expect, test } from "bun:test";
import { parseAutostashRefs, parseWorktreeForBranch } from "./index";

describe("parseWorktreeForBranch", () => {
	test("returns the path of the worktree on the given branch", () => {
		const porcelain = [
			"worktree /repo",
			"HEAD abc1234",
			"branch refs/heads/main",
			"",
			"worktree /repo/wt-feature",
			"HEAD def5678",
			"branch refs/heads/feature",
			"",
		].join("\n");

		expect(parseWorktreeForBranch(porcelain, "main")).toBe("/repo");
		expect(parseWorktreeForBranch(porcelain, "feature")).toBe(
			"/repo/wt-feature",
		);
	});

	test("returns null when the branch is not checked out anywhere", () => {
		const porcelain = [
			"worktree /repo",
			"HEAD abc1234",
			"branch refs/heads/main",
			"",
		].join("\n");

		expect(parseWorktreeForBranch(porcelain, "develop")).toBeNull();
	});

	test("ignores detached worktrees", () => {
		const porcelain = [
			"worktree /repo",
			"HEAD abc1234",
			"detached",
			"",
			"worktree /repo/wt-named",
			"HEAD def5678",
			"branch refs/heads/feature",
			"",
		].join("\n");

		expect(parseWorktreeForBranch(porcelain, "feature")).toBe("/repo/wt-named");
	});

	test("does not match prefix-overlapping branch names", () => {
		// `feature-x` and `feature` share a prefix; an overly loose matcher
		// would associate `feature` with the worktree on `feature-x`.
		const porcelain = [
			"worktree /repo",
			"HEAD abc1234",
			"branch refs/heads/feature-x",
			"",
			"worktree /repo/wt-feature",
			"HEAD def5678",
			"branch refs/heads/feature",
			"",
		].join("\n");

		expect(parseWorktreeForBranch(porcelain, "feature")).toBe(
			"/repo/wt-feature",
		);
		expect(parseWorktreeForBranch(porcelain, "feature-x")).toBe("/repo");
	});

	test("returns null on empty input", () => {
		expect(parseWorktreeForBranch("", "main")).toBeNull();
	});
});

describe("parseAutostashRefs", () => {
	test("returns SHAs of entries whose subject is exactly 'autostash'", () => {
		const stashList = [
			"abc1234 autostash",
			"def5678 On main: my manual stash",
			"ffff999 autostash",
			"1111aaa WIP on main: 0000000 some commit",
		].join("\n");

		expect(parseAutostashRefs(stashList)).toEqual(["abc1234", "ffff999"]);
	});

	test("does not match autostash as a substring of another subject", () => {
		// A user stash literally named "manual autostash" should not be
		// flagged as an autostash entry.
		const stashList = [
			"abc1234 manual autostash",
			"def5678 autostash with extra",
		].join("\n");

		expect(parseAutostashRefs(stashList)).toEqual([]);
	});

	test("returns empty array on empty input", () => {
		expect(parseAutostashRefs("")).toEqual([]);
	});
});
