import { describe, expect, test } from "bun:test";
import { WorkspaceConfig } from ".";

describe("WorkspaceConfig", () => {
	test("empty() returns all null fields", () => {
		const config = WorkspaceConfig.empty();
		expect(config.prepare).toBeNull();
		expect(config.server).toBeNull();
		expect(config.cleanup).toBeNull();
	});
});
