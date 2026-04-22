import { describe, expect, test } from "bun:test";
import {
	createTestCodingAgentProcessLogs,
	createTestCodingAgentTurn,
} from "../../../test/factories";
import { createIntegrationContext } from "../../../test/helpers/context";
import { createTestDB } from "../../../test/helpers/db";
import { seedFullChain } from "../../../test/helpers/seed";
import { Approval } from "../../models/approval";
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { deleteTask } from "./delete-task";

describe("deleteTask", () => {
	test("deletes a task with no related entities", async () => {
		const db = await createTestDB();
		const { project } = await seedFullChain(db);
		// Create a standalone task with no workspaces
		const standaloneTask = Task.create({
			projectId: project.id,
			title: "Standalone",
		});
		const ctx = createIntegrationContext(db);
		await ctx.repos.task.upsert(standaloneTask);

		const result = await deleteTask(standaloneTask.id).run(ctx);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.deleted).toBe(true);
		}
		expect(await ctx.repos.task.get(Task.ById(standaloneTask.id))).toBeNull();
	});

	test("cascade deletes all related entities", async () => {
		const db = await createTestDB();
		const { task, workspace, session, executionProcess } =
			await seedFullChain(db);
		const ctx = createIntegrationContext(db);

		// Add child entities that depend on coding_agent_process
		const turn = createTestCodingAgentTurn({
			executionProcessId: executionProcess.id,
		});
		await ctx.repos.codingAgentTurn.upsert(turn);

		const logs = createTestCodingAgentProcessLogs({
			codingAgentProcessId: executionProcess.id,
		});
		await ctx.repos.codingAgentProcessLogs.upsertLogs(logs);

		const approval = Approval.create({
			executionProcessId: executionProcess.id,
			toolName: "TestTool",
			toolCallId: "call-1",
		});
		await ctx.repos.approval.upsert(approval);

		// Delete task
		const result = await deleteTask(task.id).run(ctx);
		expect(result.ok).toBe(true);

		// Verify all entities are gone
		expect(await ctx.repos.task.get(Task.ById(task.id))).toBeNull();
		expect(
			await ctx.repos.workspace.get(Workspace.ById(workspace.id)),
		).toBeNull();
		expect(await ctx.repos.session.get(Session.ById(session.id))).toBeNull();
		expect(
			await ctx.repos.codingAgentProcess.get(
				CodingAgentProcess.ById(executionProcess.id),
			),
		).toBeNull();
		expect(
			await ctx.repos.codingAgentProcessLogs.getLogs(executionProcess.id),
		).toBeNull();
	});

	test("returns NOT_FOUND for non-existent task", async () => {
		const db = await createTestDB();
		const ctx = createIntegrationContext(db);

		const result = await deleteTask("non-existent").run(ctx);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});
});
