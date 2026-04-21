import { describe, expect, it } from "bun:test";
import * as os from "node:os";
import * as path from "node:path";
import { createLogger } from "../../../infra/logger";
import type { ServiceCtx } from "../../common";
import { WorktreeRepository } from "./index";

const ctx = {} as ServiceCtx;

describe("WorktreeRepository.getWorktreePath", () => {
	const base = path.join(os.tmpdir(), "autokanban-test");
	const repo = new WorktreeRepository(createLogger(), base);

	it("returns a path under the base for a plain name", () => {
		const result = repo.getWorktreePath(ctx, "ws-1", "my-project");
		expect(result).toBe(path.join(base, "ws-1", "my-project"));
	});

	it("throws for names that escape the base via ..", () => {
		expect(() =>
			repo.getWorktreePath(ctx, "ws-1", "../../../etc/passwd"),
		).toThrow(/escapes worktree base directory/);
	});
});
