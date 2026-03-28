import { beforeEach, describe, expect, test } from "vitest";
import { executionActions, executionStore } from "./execution";

describe("executionStore", () => {
	beforeEach(() => {
		executionStore.activeExecutions = {};
	});

	describe("startExecution", () => {
		test("adds execution with running status", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			const exec = executionStore.activeExecutions["task-1"];
			expect(exec).toEqual({
				executionProcessId: "exec-1",
				sessionId: "sess-1",
				workspaceId: "ws-1",
				status: "running",
			});
		});

		test("overwrites existing entry for same taskId", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			executionActions.startExecution("task-1", "exec-2", "sess-2", "ws-2");
			expect(executionStore.activeExecutions["task-1"].executionProcessId).toBe(
				"exec-2",
			);
		});
	});

	describe("setExecutionInfo", () => {
		test("sets execution info directly", () => {
			executionActions.setExecutionInfo("task-1", {
				executionProcessId: "exec-1",
				sessionId: "sess-1",
				workspaceId: "ws-1",
				status: "completed",
			});
			expect(executionStore.activeExecutions["task-1"].status).toBe(
				"completed",
			);
			expect(executionStore.activeExecutions["task-1"].workspaceId).toBe(
				"ws-1",
			);
		});

		test("defaults workspaceId to empty string when omitted", () => {
			executionActions.setExecutionInfo("task-1", {
				executionProcessId: "exec-1",
				sessionId: "sess-1",
				status: "running",
			});
			expect(executionStore.activeExecutions["task-1"].workspaceId).toBe("");
		});
	});

	describe("updateExecutionStatus", () => {
		test("updates status of existing entry", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			executionActions.updateExecutionStatus("task-1", "completed");
			expect(executionStore.activeExecutions["task-1"].status).toBe(
				"completed",
			);
		});

		test("no-op for non-existent taskId", () => {
			executionActions.updateExecutionStatus("nonexistent", "failed");
			expect(executionStore.activeExecutions.nonexistent).toBeUndefined();
		});
	});

	describe("clearExecution", () => {
		test("removes execution entry", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			executionActions.clearExecution("task-1");
			expect(executionStore.activeExecutions["task-1"]).toBeUndefined();
		});

		test("no-op for non-existent taskId", () => {
			executionActions.clearExecution("nonexistent");
			expect(Object.keys(executionStore.activeExecutions)).toHaveLength(0);
		});
	});

	describe("getExecution", () => {
		test("returns existing execution", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			const result = executionActions.getExecution("task-1");
			expect(result).toBeDefined();
			expect(result?.executionProcessId).toBe("exec-1");
		});

		test("returns undefined for non-existent taskId", () => {
			expect(executionActions.getExecution("nonexistent")).toBeUndefined();
		});
	});

	describe("isTaskExecuting", () => {
		test("returns true when status is running", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			expect(executionActions.isTaskExecuting("task-1")).toBe(true);
		});

		test("returns false when status is completed", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			executionActions.updateExecutionStatus("task-1", "completed");
			expect(executionActions.isTaskExecuting("task-1")).toBe(false);
		});

		test("returns false when status is failed", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			executionActions.updateExecutionStatus("task-1", "failed");
			expect(executionActions.isTaskExecuting("task-1")).toBe(false);
		});

		test("returns false when status is killed", () => {
			executionActions.startExecution("task-1", "exec-1", "sess-1", "ws-1");
			executionActions.updateExecutionStatus("task-1", "killed");
			expect(executionActions.isTaskExecuting("task-1")).toBe(false);
		});

		test("returns false for non-existent taskId", () => {
			expect(executionActions.isTaskExecuting("nonexistent")).toBe(false);
		});
	});
});
