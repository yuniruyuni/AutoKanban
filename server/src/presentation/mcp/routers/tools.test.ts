import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { Task } from "../../../models/task";
import { TaskStatusSchema } from "../../trpc/routers/task";
import { buildInputSchema, formatZodError } from "./tools";

describe("TaskStatusSchema", () => {
	it("accepts every status declared on Task.statuses", () => {
		for (const status of Task.statuses) {
			expect(TaskStatusSchema.safeParse(status).success).toBe(true);
		}
	});

	it("rejects unknown statuses (drift between Task.statuses and MCP enum)", () => {
		expect(TaskStatusSchema.safeParse("archived").success).toBe(false);
	});
});

describe("buildInputSchema", () => {
	it("emits a draft-7 JSON Schema with required fields and enum values", () => {
		const schema = z
			.object({
				project_id: z.string().uuid(),
				status: TaskStatusSchema.optional(),
			})
			.strict();

		const json = buildInputSchema(schema) as {
			type: string;
			required?: string[];
			properties: { status: { enum: string[] } };
			$schema?: string;
		};

		expect(json.type).toBe("object");
		expect(json.required).toEqual(["project_id"]);
		expect(json.properties.status.enum).toEqual([...Task.statuses]);
		expect(json.$schema).toBeUndefined();
	});
});

describe("formatZodError", () => {
	it("includes the offending field path and reason for each issue", () => {
		const schema = z
			.object({
				project_id: z.string().uuid(),
				title: z.string().min(1),
			})
			.strict();

		const result = schema.safeParse({ project_id: "not-a-uuid", title: "" });
		expect(result.success).toBe(false);
		if (result.success) return;

		const message = formatZodError(result.error, "create_task");
		expect(message).toContain('Invalid input for tool "create_task"');
		expect(message).toContain("project_id");
		expect(message).toContain("title");
	});

	it("uses (root) when the issue is not nested under a field", () => {
		const schema = z.object({}).strict();
		const result = schema.safeParse("not-an-object");
		expect(result.success).toBe(false);
		if (result.success) return;

		const message = formatZodError(result.error, "list_projects");
		expect(message).toContain("(root)");
	});
});
