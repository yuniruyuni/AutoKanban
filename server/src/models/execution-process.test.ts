import { describe, expect, test } from "bun:test";
import { ExecutionProcess } from "./execution-process";

// ============================================
// ExecutionProcess.create()
// ============================================

describe("ExecutionProcess.create()", () => {
	test('creates with status "running"', () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		expect(ep.status).toBe("running");
	});

	test("generates a UUID id", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		expect(ep.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("sets sessionId and runReason", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "setupscript",
		});
		expect(ep.sessionId).toBe("s1");
		expect(ep.runReason).toBe("setupscript");
	});

	test("exitCode defaults to null", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		expect(ep.exitCode).toBeNull();
	});

	test("completedAt defaults to null", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		expect(ep.completedAt).toBeNull();
	});

	test("sets startedAt, createdAt, updatedAt", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		expect(ep.startedAt).toBeInstanceOf(Date);
		expect(ep.createdAt).toBeInstanceOf(Date);
		expect(ep.updatedAt).toBeInstanceOf(Date);
	});
});

// ============================================
// ExecutionProcess.complete()
// ============================================

describe("ExecutionProcess.complete()", () => {
	test("transitions to completed with exit code", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		const completed = ExecutionProcess.complete(ep, "completed", 0);
		expect(completed.status).toBe("completed");
		expect(completed.exitCode).toBe(0);
		expect(completed.completedAt).toBeInstanceOf(Date);
	});

	test("transitions to failed with non-zero exit code", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		const failed = ExecutionProcess.complete(ep, "failed", 1);
		expect(failed.status).toBe("failed");
		expect(failed.exitCode).toBe(1);
	});

	test("transitions to killed with null exit code", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		const killed = ExecutionProcess.complete(ep, "killed", null);
		expect(killed.status).toBe("killed");
		expect(killed.exitCode).toBeNull();
	});

	test("preserves original fields", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "devserver",
		});
		const completed = ExecutionProcess.complete(ep, "completed", 0);
		expect(completed.id).toBe(ep.id);
		expect(completed.sessionId).toBe("s1");
		expect(completed.runReason).toBe("devserver");
		expect(completed.startedAt).toEqual(ep.startedAt);
		expect(completed.createdAt).toEqual(ep.createdAt);
	});

	test("updates updatedAt", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		const completed = ExecutionProcess.complete(ep, "completed", 0);
		expect(completed.updatedAt.getTime()).toBeGreaterThanOrEqual(
			ep.updatedAt.getTime(),
		);
	});
});

// ============================================
// ExecutionProcess Specs
// ============================================

describe("ExecutionProcess specs", () => {
	test("ById creates a spec", () => {
		const spec = ExecutionProcess.ById("ep-1");
		expect((spec as { type: string }).type).toBe("ById");
	});

	test("BySessionId creates a spec", () => {
		const spec = ExecutionProcess.BySessionId("s1");
		expect((spec as { type: string }).type).toBe("BySessionId");
	});

	test("ByStatus creates a spec", () => {
		const spec = ExecutionProcess.ByStatus("running");
		expect((spec as { type: string }).type).toBe("ByStatus");
	});

	test("ByRunReason creates a spec", () => {
		const spec = ExecutionProcess.ByRunReason("codingagent");
		expect((spec as { type: string }).type).toBe("ByRunReason");
	});
});

// ============================================
// ExecutionProcess constants
// ============================================

describe("ExecutionProcess constants", () => {
	test("statuses contains all 5 statuses", () => {
		expect(ExecutionProcess.statuses).toEqual([
			"running",
			"completed",
			"failed",
			"killed",
			"awaiting_approval",
		]);
	});

	test("runReasons contains all 4 reasons", () => {
		expect(ExecutionProcess.runReasons).toEqual([
			"setupscript",
			"codingagent",
			"devserver",
			"cleanupscript",
		]);
	});
});
