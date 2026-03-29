import type { Database } from "bun:sqlite";
import type { ExecutionProcess } from "../../src/models/execution-process";
import type { Project } from "../../src/models/project";
import type { Session } from "../../src/models/session";
import type { Task } from "../../src/models/task";
import type { Workspace } from "../../src/models/workspace";
import { ExecutionProcessRepository } from "../../src/repositories/execution-process-repository";
import { ProjectRepository } from "../../src/repositories/project-repository";
import { SessionRepository } from "../../src/repositories/session-repository";
import { TaskRepository } from "../../src/repositories/task";
import { WorkspaceRepository } from "../../src/repositories/workspace-repository";
import {
	createTestExecutionProcess,
	createTestProject,
	createTestSession,
	createTestTask,
	createTestWorkspace,
} from "../factories";

export interface SeedResult {
	project: Project;
	task: Task;
	workspace: Workspace;
	session: Session;
	executionProcess: ExecutionProcess;
}

/**
 * Build the full FK dependency chain in the DB and return all created entities.
 * projects → tasks → workspaces → sessions → execution_processes
 */
export function seedFullChain(db: Database): SeedResult {
	const project = createTestProject();
	const task = createTestTask({ projectId: project.id });
	const workspace = createTestWorkspace({ taskId: task.id });
	const session = createTestSession({ workspaceId: workspace.id });
	const executionProcess = createTestExecutionProcess({
		sessionId: session.id,
	});

	new ProjectRepository(db).upsert(project);
	new TaskRepository(db).upsert(task);
	new WorkspaceRepository(db).upsert(workspace);
	new SessionRepository(db).upsert(session);
	new ExecutionProcessRepository(db).upsert(executionProcess);

	return { project, task, workspace, session, executionProcess };
}
