import type { Database } from "../../src/lib/db/database";
import type { ExecutionProcess } from "../../src/models/execution-process";
import type { Project } from "../../src/models/project";
import type { Session } from "../../src/models/session";
import type { Task } from "../../src/models/task";
import type { Workspace } from "../../src/models/workspace";
import { createDbWriteCtx } from "../../src/repositories/common";
import { ExecutionProcessRepository } from "../../src/repositories/execution-process/postgres";
import { ProjectRepository } from "../../src/repositories/project/postgres";
import { SessionRepository } from "../../src/repositories/session/postgres";
import { TaskRepository } from "../../src/repositories/task/postgres";
import { WorkspaceRepository } from "../../src/repositories/workspace/postgres";
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
export async function seedFullChain(db: Database): Promise<SeedResult> {
	const project = createTestProject();
	const task = createTestTask({ projectId: project.id });
	const workspace = createTestWorkspace({ taskId: task.id });
	const session = createTestSession({ workspaceId: workspace.id });
	const executionProcess = createTestExecutionProcess({
		sessionId: session.id,
	});

	const wCtx = createDbWriteCtx(db);
	await new ProjectRepository().upsert(wCtx, project);
	await new TaskRepository().upsert(wCtx, task);
	await new WorkspaceRepository().upsert(wCtx, workspace);
	await new SessionRepository().upsert(wCtx, session);
	await new ExecutionProcessRepository().upsert(wCtx, executionProcess);

	return { project, task, workspace, session, executionProcess };
}
