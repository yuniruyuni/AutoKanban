import { afterEach, describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { getAutoKanbanHome } from "./paths";

/**
 * Guards the env-var override that lets a spawned child AutoKanban (Preview
 * of the AutoKanban project itself) run with a fully isolated state
 * directory so its startup recovery does not stomp on the parent's DB.
 */

const ORIGINAL = process.env.AUTO_KANBAN_HOME;

afterEach(() => {
	if (ORIGINAL === undefined) {
		delete process.env.AUTO_KANBAN_HOME;
	} else {
		process.env.AUTO_KANBAN_HOME = ORIGINAL;
	}
});

describe("getAutoKanbanHome", () => {
	test("defaults to ~/.auto-kanban when AUTO_KANBAN_HOME is unset", () => {
		delete process.env.AUTO_KANBAN_HOME;
		expect(getAutoKanbanHome()).toBe(join(homedir(), ".auto-kanban"));
	});

	test("returns AUTO_KANBAN_HOME verbatim when set", () => {
		process.env.AUTO_KANBAN_HOME = "/tmp/ak-override-xyz";
		expect(getAutoKanbanHome()).toBe("/tmp/ak-override-xyz");
	});

	test("re-reads the env on each call (no module-load caching)", () => {
		process.env.AUTO_KANBAN_HOME = "/tmp/ak-first";
		expect(getAutoKanbanHome()).toBe("/tmp/ak-first");

		process.env.AUTO_KANBAN_HOME = "/tmp/ak-second";
		expect(getAutoKanbanHome()).toBe("/tmp/ak-second");
	});
});
