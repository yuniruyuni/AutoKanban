import {
	CodingAgentProcess,
	type CodingAgentProcessLogs,
} from "../../src/models/coding-agent-process";
import { CodingAgentTurn } from "../../src/models/coding-agent-turn";
import { DevServerProcess } from "../../src/models/dev-server-process";
import { Project } from "../../src/models/project";
import { Session } from "../../src/models/session";
import { Task } from "../../src/models/task";
import { Tool } from "../../src/models/tool";
import { Variant } from "../../src/models/variant";
import { Workspace } from "../../src/models/workspace";
import { WorkspaceRepo } from "../../src/models/workspace-repo";
import { WorkspaceScriptProcess } from "../../src/models/workspace-script-process";

/**
 * Create a test Task with sensible defaults and overrides.
 */
export function createTestTask(overrides: Partial<Task> = {}): Task {
	const base = Task.create({
		projectId: "test-project-id",
		title: "Test Task",
		description: "Test task description",
	});
	return { ...base, ...overrides };
}

/**
 * Create a test Project with sensible defaults and overrides.
 */
export function createTestProject(overrides: Partial<Project> = {}): Project {
	const base = Project.create({
		name: "Test Project",
		description: "Test project description",
		repoPath: `/tmp/test-repo-${Date.now()}`,
	});
	return { ...base, ...overrides };
}

/**
 * Create a test Session with sensible defaults and overrides.
 */
export function createTestSession(overrides: Partial<Session> = {}): Session {
	const base = Session.create({
		workspaceId: "test-workspace-id",
	});
	return { ...base, ...overrides };
}

/**
 * Create a test Workspace with sensible defaults and overrides.
 */
export function createTestWorkspace(
	overrides: Partial<Workspace> = {},
): Workspace {
	const base = Workspace.create({
		taskId: "test-task-id",
	});
	return { ...base, ...overrides };
}

/**
 * Create a test CodingAgentProcess with sensible defaults and overrides.
 */
export function createTestCodingAgentProcess(
	overrides: Partial<CodingAgentProcess> = {},
): CodingAgentProcess {
	const base = CodingAgentProcess.create({
		sessionId: "test-session-id",
	});
	return { ...base, ...overrides };
}

/**
 * Create a test DevServerProcess with sensible defaults and overrides.
 */
export function createTestDevServerProcess(
	overrides: Partial<DevServerProcess> = {},
): DevServerProcess {
	const base = DevServerProcess.create({
		sessionId: "test-session-id",
		proxyPort: 12345,
	});
	return { ...base, ...overrides };
}

/**
 * Create a test WorkspaceScriptProcess with sensible defaults and overrides.
 */
export function createTestWorkspaceScriptProcess(
	overrides: Partial<WorkspaceScriptProcess> = {},
): WorkspaceScriptProcess {
	const base = WorkspaceScriptProcess.create({
		sessionId: "test-session-id",
		scriptType: "prepare",
	});
	return { ...base, ...overrides };
}

/**
 * Create a test CodingAgentTurn with sensible defaults and overrides.
 */
export function createTestCodingAgentTurn(
	overrides: Partial<CodingAgentTurn> = {},
): CodingAgentTurn {
	const base = CodingAgentTurn.create({
		executionProcessId: "test-execution-process-id",
		prompt: "Test prompt",
	});
	return { ...base, ...overrides };
}

/**
 * Create a test Tool with sensible defaults and overrides.
 */
export function createTestTool(overrides: Partial<Tool> = {}): Tool {
	const base = Tool.create({
		name: "Test Tool",
		icon: "wrench",
		command: "echo test",
	});
	return { ...base, ...overrides };
}

/**
 * Create a test WorkspaceRepo with sensible defaults and overrides.
 */
export function createTestWorkspaceRepo(
	overrides: Partial<WorkspaceRepo> = {},
): WorkspaceRepo {
	const base = WorkspaceRepo.create({
		workspaceId: "test-workspace-id",
		projectId: "test-project-id",
		targetBranch: "main",
	});
	return { ...base, ...overrides };
}

/**
 * Create test CodingAgentProcessLogs directly.
 */
export function createTestCodingAgentProcessLogs(
	overrides: Partial<CodingAgentProcessLogs> = {},
): CodingAgentProcessLogs {
	return {
		codingAgentProcessId: "test-coding-agent-process-id",
		logs: "test log output",
		...overrides,
	};
}

/**
 * Create a test Variant with sensible defaults and overrides.
 */
export function createTestVariant(overrides: Partial<Variant> = {}): Variant {
	const base = Variant.create({
		executor: "claude-code",
		name: "TEST",
		permissionMode: "bypassPermissions",
	});
	return { ...base, ...overrides };
}
