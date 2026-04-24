import { describe, expect, test } from "bun:test";
import { CodexCliLogParser } from "./codex-cli";

function logLine(
	source: "stdout" | "stderr",
	data: string | object,
	ts = "2026-04-24T10:00:00.000Z",
): string {
	const content = typeof data === "string" ? data : JSON.stringify(data);
	return `[${ts}] [${source}] ${content}`;
}

describe("CodexCliLogParser", () => {
	test("parses assistant messages from Codex JSONL events", () => {
		const parser = new CodexCliLogParser();
		const result = parser.parse(
			logLine("stdout", {
				msg: { type: "agent_message", message: "Done." },
			}),
		);

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("assistant_message");
		if (result.entries[0].type.kind === "assistant_message") {
			expect(result.entries[0].type.text).toBe("Done.");
		}
	});

	test("combines exec begin and end events into a tool entry", () => {
		const parser = new CodexCliLogParser();
		const result = parser.parse(
			[
				logLine("stdout", {
					msg: {
						type: "exec_command_begin",
						call_id: "call-1",
						command: "bun test",
					},
				}),
				logLine(
					"stdout",
					{
						msg: {
							type: "exec_command_end",
							call_id: "call-1",
							exit_code: 0,
							output: "ok",
						},
					},
					"2026-04-24T10:00:01.000Z",
				),
			].join(""),
		);

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("tool");
		if (result.entries[0].type.kind === "tool") {
			expect(result.entries[0].type.status).toBe("success");
			expect(result.entries[0].type.result?.output).toBe("ok");
		}
	});

	test("parses stderr as an error entry", () => {
		const parser = new CodexCliLogParser();
		const result = parser.parse(logLine("stderr", "boom"));

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("error");
	});
});
