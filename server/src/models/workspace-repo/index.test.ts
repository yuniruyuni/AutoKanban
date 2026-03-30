import { describe, expect, test } from "bun:test";
import { WorkspaceRepo } from ".";

describe("WorkspaceRepo.create()", () => {
	test("creates with required fields", () => {
		const wr = WorkspaceRepo.create({
			workspaceId: "ws-1",
			projectId: "proj-1",
			targetBranch: "main",
		});
		expect(wr.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(wr.workspaceId).toBe("ws-1");
		expect(wr.projectId).toBe("proj-1");
		expect(wr.targetBranch).toBe("main");
		expect(wr.prUrl).toBeNull();
		expect(wr.createdAt).toBeInstanceOf(Date);
		expect(wr.updatedAt).toBeInstanceOf(Date);
	});

	test("creates with optional prUrl", () => {
		const wr = WorkspaceRepo.create({
			workspaceId: "ws-1",
			projectId: "proj-1",
			targetBranch: "main",
			prUrl: "https://github.com/org/repo/pull/1",
		});
		expect(wr.prUrl).toBe("https://github.com/org/repo/pull/1");
	});
});

describe("WorkspaceRepo specs", () => {
	test("ById", () => {
		const spec = WorkspaceRepo.ById("abc");
		expect((spec as { type: string }).type).toBe("ById");
	});

	test("ByWorkspaceId", () => {
		const spec = WorkspaceRepo.ByWorkspaceId("ws-1");
		expect((spec as { type: string }).type).toBe("ByWorkspaceId");
	});

	test("ByProjectId", () => {
		const spec = WorkspaceRepo.ByProjectId("proj-1");
		expect((spec as { type: string }).type).toBe("ByProjectId");
	});

	test("ByWorkspaceAndProject", () => {
		const spec = WorkspaceRepo.ByWorkspaceAndProject("ws-1", "proj-1");
		expect((spec as { type: string }).type).toBe("ByWorkspaceAndProject");
	});
});

describe("WorkspaceRepo.cursor()", () => {
	test("serializes sort keys", () => {
		const wr = WorkspaceRepo.create({
			workspaceId: "ws-1",
			projectId: "proj-1",
			targetBranch: "main",
		});
		const cursor = WorkspaceRepo.cursor(wr, ["createdAt", "id"]);
		expect(cursor.createdAt).toBe(wr.createdAt.toISOString());
		expect(cursor.id).toBe(wr.id);
	});
});

describe("WorkspaceRepo constants", () => {
	test("defaultSort", () => {
		expect(WorkspaceRepo.defaultSort.keys).toEqual(["createdAt", "id"]);
		expect(WorkspaceRepo.defaultSort.order).toBe("asc");
	});
});
