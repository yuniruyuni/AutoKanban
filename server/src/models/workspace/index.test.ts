import { describe, expect, test } from "bun:test";
import { Workspace } from ".";

// ============================================
// Workspace.create()
// ============================================

describe("Workspace.create()", () => {
	test("creates a workspace with taskId", () => {
		const ws = Workspace.create({ taskId: "task-1" });
		expect(ws.taskId).toBe("task-1");
	});

	test("generates a UUID id", () => {
		const ws = Workspace.create({ taskId: "task-1" });
		expect(ws.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("containerRef defaults to empty string", () => {
		const ws = Workspace.create({ taskId: "task-1" });
		expect(ws.containerRef).toBe("");
	});

	test("containerRef can be set", () => {
		const ws = Workspace.create({
			taskId: "task-1",
			containerRef: "container-abc",
		});
		expect(ws.containerRef).toBe("container-abc");
	});

	test("branch defaults to generated branch name with attempt", () => {
		const ws = Workspace.create({ taskId: "abcdefgh-1234-5678" });
		expect(ws.branch).toBe("ak-abcdefgh-1");
	});

	test("branch can be overridden", () => {
		const ws = Workspace.create({ taskId: "task-1", branch: "custom-branch" });
		expect(ws.branch).toBe("custom-branch");
	});

	test("worktreePath defaults to null", () => {
		const ws = Workspace.create({ taskId: "task-1" });
		expect(ws.worktreePath).toBeNull();
	});

	test("worktreePath can be set", () => {
		const ws = Workspace.create({
			taskId: "task-1",
			worktreePath: "/tmp/worktree",
		});
		expect(ws.worktreePath).toBe("/tmp/worktree");
	});

	test("setupComplete defaults to false", () => {
		const ws = Workspace.create({ taskId: "task-1" });
		expect(ws.setupComplete).toBe(false);
	});

	test("attempt defaults to 1", () => {
		const ws = Workspace.create({ taskId: "task-1" });
		expect(ws.attempt).toBe(1);
	});

	test("attempt can be set", () => {
		const ws = Workspace.create({ taskId: "task-1", attempt: 3 });
		expect(ws.attempt).toBe(3);
	});

	test("archived defaults to false", () => {
		const ws = Workspace.create({ taskId: "task-1" });
		expect(ws.archived).toBe(false);
	});

	test("branch includes attempt number", () => {
		const ws = Workspace.create({ taskId: "abcdefgh-1234", attempt: 3 });
		expect(ws.branch).toBe("ak-abcdefgh-3");
	});

	test("sets createdAt and updatedAt", () => {
		const ws = Workspace.create({ taskId: "task-1" });
		expect(ws.createdAt).toBeInstanceOf(Date);
		expect(ws.createdAt).toEqual(ws.updatedAt);
	});
});

// ============================================
// Workspace.generateBranchName()
// ============================================

describe("Workspace.generateBranchName()", () => {
	test("generates branch name with first 8 chars of taskId and attempt", () => {
		expect(Workspace.generateBranchName("abcdefgh-1234", 1)).toBe(
			"ak-abcdefgh-1",
		);
	});

	test("handles short taskId", () => {
		expect(Workspace.generateBranchName("abc", 1)).toBe("ak-abc-1");
	});

	test("handles exactly 8 char taskId", () => {
		expect(Workspace.generateBranchName("12345678", 1)).toBe("ak-12345678-1");
	});

	test("includes attempt number in branch name", () => {
		expect(Workspace.generateBranchName("abcdefgh-1234", 3)).toBe(
			"ak-abcdefgh-3",
		);
	});
});

// ============================================
// Workspace.resolveWorkingDir()
// ============================================

describe("Workspace.resolveWorkingDir()", () => {
	test("returns worktreePath/projectName when both exist", () => {
		const ws = Workspace.create({ taskId: "t1", worktreePath: "/tmp/wt" });
		const result = Workspace.resolveWorkingDir(ws, {
			name: "myproject",
			repoPath: "/repo",
		});
		expect(result).toBe("/tmp/wt/myproject");
	});

	test("returns worktreePath when project is null", () => {
		const ws = Workspace.create({ taskId: "t1", worktreePath: "/tmp/wt" });
		expect(Workspace.resolveWorkingDir(ws, null)).toBe("/tmp/wt");
	});

	test("returns project.repoPath when worktreePath is null", () => {
		const ws = Workspace.create({ taskId: "t1" }); // worktreePath: null
		const result = Workspace.resolveWorkingDir(ws, {
			name: "myproject",
			repoPath: "/repo",
		});
		expect(result).toBe("/repo");
	});

	test("returns null when both worktreePath and project are null", () => {
		const ws = Workspace.create({ taskId: "t1" });
		expect(Workspace.resolveWorkingDir(ws, null)).toBeNull();
	});
});

// ============================================
// Workspace.determineAttemptStrategy()
// ============================================

describe("Workspace.determineAttemptStrategy()", () => {
	test("reuses active workspace with no sessions", () => {
		const active = Workspace.create({ taskId: "t1" });
		const result = Workspace.determineAttemptStrategy({
			activeWorkspace: active,
			activeHasSessions: false,
			maxAttempt: 1,
			taskId: "t1",
			containerRef: "/repo",
		});
		expect(result.action).toBe("reuse");
		expect(result.workspace.id).toBe(active.id);
	});

	test("creates new workspace when active has sessions", () => {
		const active = Workspace.create({ taskId: "t1" });
		const result = Workspace.determineAttemptStrategy({
			activeWorkspace: active,
			activeHasSessions: true,
			maxAttempt: 1,
			taskId: "t1",
			containerRef: "/repo",
		});
		expect(result.action).toBe("new");
		if (result.action === "new") {
			expect(result.workspace.attempt).toBe(2);
			expect(result.workspaceToArchive?.id).toBe(active.id);
		}
	});

	test("creates new workspace when no active workspace exists", () => {
		const result = Workspace.determineAttemptStrategy({
			activeWorkspace: null,
			activeHasSessions: false,
			maxAttempt: 0,
			taskId: "t1",
			containerRef: "/repo",
		});
		expect(result.action).toBe("new");
		if (result.action === "new") {
			expect(result.workspace.attempt).toBe(1);
			expect(result.workspaceToArchive).toBeNull();
		}
	});
});

// ============================================
// Workspace Specs
// ============================================

describe("Workspace specs", () => {
	test("ById creates a spec", () => {
		const spec = Workspace.ById("ws-1");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("ws-1");
	});

	test("ByTaskId creates a spec", () => {
		const spec = Workspace.ByTaskId("task-1");
		expect((spec as { type: string }).type).toBe("ByTaskId");
		expect((spec as { taskId: string }).taskId).toBe("task-1");
	});
});

// ============================================
// Workspace.cursor()
// ============================================

describe("Workspace.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const ws: Workspace = {
		id: "ws-1",
		taskId: "task-1",
		containerRef: "",
		branch: "ak-task-1",
		worktreePath: null,
		setupComplete: false,
		attempt: 1,
		archived: false,
		createdAt: now,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = Workspace.cursor(ws, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = Workspace.cursor(ws, ["id"]);
		expect(cursor.id).toBe("ws-1");
	});
});
