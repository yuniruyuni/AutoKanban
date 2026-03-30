import { describe, expect, test } from "bun:test";
import { createBranchStatus, hasConflicts, needsSync } from ".";

// ============================================
// createBranchStatus()
// ============================================

describe("createBranchStatus()", () => {
	test("creates with required fields", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
		});
		expect(status.branch).toBe("feature");
		expect(status.targetBranch).toBe("main");
	});

	test("defaults boolean fields to false", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
		});
		expect(status.isRebaseInProgress).toBe(false);
		expect(status.isMergeInProgress).toBe(false);
	});

	test("defaults conflictOp to null", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
		});
		expect(status.conflictOp).toBeNull();
	});

	test("defaults conflictedFiles to empty array", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
		});
		expect(status.conflictedFiles).toEqual([]);
	});

	test("defaults ahead/behind to 0", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
		});
		expect(status.ahead).toBe(0);
		expect(status.behind).toBe(0);
	});

	test("defaults commit info to null", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
		});
		expect(status.lastCommitHash).toBeNull();
		expect(status.lastCommitMessage).toBeNull();
	});

	test("accepts all optional fields", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
			isRebaseInProgress: true,
			isMergeInProgress: false,
			conflictOp: "rebase",
			conflictedFiles: ["file1.ts", "file2.ts"],
			ahead: 3,
			behind: 5,
			lastCommitHash: "abc123",
			lastCommitMessage: "Fix bug",
		});
		expect(status.isRebaseInProgress).toBe(true);
		expect(status.conflictOp).toBe("rebase");
		expect(status.conflictedFiles).toEqual(["file1.ts", "file2.ts"]);
		expect(status.ahead).toBe(3);
		expect(status.behind).toBe(5);
		expect(status.lastCommitHash).toBe("abc123");
		expect(status.lastCommitMessage).toBe("Fix bug");
	});
});

// ============================================
// hasConflicts()
// ============================================

describe("hasConflicts()", () => {
	test("returns false when no conflicted files", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
		});
		expect(hasConflicts(status)).toBe(false);
	});

	test("returns true when there are conflicted files", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
			conflictedFiles: ["file1.ts"],
		});
		expect(hasConflicts(status)).toBe(true);
	});
});

// ============================================
// needsSync()
// ============================================

describe("needsSync()", () => {
	test("returns false when behind is 0", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
		});
		expect(needsSync(status)).toBe(false);
	});

	test("returns true when behind is greater than 0", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
			behind: 3,
		});
		expect(needsSync(status)).toBe(true);
	});

	test("ahead alone does not mean needs sync", () => {
		const status = createBranchStatus({
			branch: "feature",
			targetBranch: "main",
			ahead: 5,
			behind: 0,
		});
		expect(needsSync(status)).toBe(false);
	});
});
