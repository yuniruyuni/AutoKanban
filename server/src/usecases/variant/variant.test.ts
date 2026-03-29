import { describe, expect, test } from "bun:test";
import { createTestVariant } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import type { Variant } from "../../models/variant";
import { createVariant } from "./create-variant";
import { deleteVariant } from "./delete-variant";
import { listVariants } from "./list-variants";
import { updateVariant } from "./update-variant";

// ============================================
// listVariants
// ============================================

describe("listVariants", () => {
	test("returns variants for the specified executor", async () => {
		const variants = [
			createTestVariant({ name: "DEFAULT" }),
			createTestVariant({ name: "PLAN" }),
		];

		const ctx = createMockContext({
			variant: {
				listByExecutor: (executor: string) => {
					expect(executor).toBe("claude-code");
					return variants;
				},
			} as never,
		});

		const result = await listVariants({ executor: "claude-code" }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.items).toHaveLength(2);
			expect(result.value.items[0].name).toBe("DEFAULT");
			expect(result.value.items[1].name).toBe("PLAN");
		}
	});

	test("returns empty array when no variants exist", async () => {
		const ctx = createMockContext({
			variant: {
				listByExecutor: () => [],
			} as never,
		});

		const result = await listVariants({ executor: "unknown" }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.items).toHaveLength(0);
		}
	});
});

// ============================================
// createVariant
// ============================================

describe("createVariant", () => {
	test("creates a variant with specified fields", async () => {
		let upserted = null as Variant | null;

		const ctx = createMockContext({
			variant: {
				upsert: (v: Variant) => {
					upserted = v;
				},
			} as never,
		});

		const result = await createVariant({
			executor: "claude-code",
			name: "CUSTOM",
			permissionMode: "plan",
			model: "opus",
			appendPrompt: "Be brief",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.executor).toBe("claude-code");
			expect(result.value.name).toBe("CUSTOM");
			expect(result.value.permissionMode).toBe("plan");
			expect(result.value.model).toBe("opus");
			expect(result.value.appendPrompt).toBe("Be brief");
			expect(result.value.id).toBeDefined();
		}
		expect(upserted).not.toBeNull();
		expect(upserted?.name).toBe("CUSTOM");
	});

	test("uses default permissionMode when not specified", async () => {
		const ctx = createMockContext({
			variant: { upsert: () => {} } as never,
		});

		const result = await createVariant({
			executor: "claude-code",
			name: "BASIC",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.permissionMode).toBe("bypassPermissions");
			expect(result.value.model).toBeNull();
			expect(result.value.appendPrompt).toBeNull();
		}
	});
});

// ============================================
// updateVariant
// ============================================

describe("updateVariant", () => {
	test("updates specified fields", async () => {
		const existing = createTestVariant({
			name: "OLD",
			permissionMode: "bypassPermissions",
			model: null,
		});

		let upserted = null as Variant | null;

		const ctx = createMockContext({
			variant: {
				get: (spec: { id?: string }) => {
					if ("id" in spec && spec.id === existing.id) return existing;
					return null;
				},
				upsert: (v: Variant) => {
					upserted = v;
				},
			} as never,
		});

		const result = await updateVariant({
			variantId: existing.id,
			name: "NEW",
			permissionMode: "plan",
			model: "opus",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("NEW");
			expect(result.value.permissionMode).toBe("plan");
			expect(result.value.model).toBe("opus");
			expect(result.value.id).toBe(existing.id);
		}
		expect(upserted?.name).toBe("NEW");
	});

	test("preserves unchanged fields", async () => {
		const existing = createTestVariant({
			name: "KEEP",
			permissionMode: "plan",
			model: "opus",
			appendPrompt: "Keep this",
		});

		const ctx = createMockContext({
			variant: {
				get: () => existing,
				upsert: () => {},
			} as never,
		});

		const result = await updateVariant({
			variantId: existing.id,
			// Only update name
			name: "RENAMED",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("RENAMED");
			expect(result.value.permissionMode).toBe("plan");
			expect(result.value.model).toBe("opus");
			expect(result.value.appendPrompt).toBe("Keep this");
		}
	});

	test("allows setting model to null", async () => {
		const existing = createTestVariant({ model: "opus" });

		const ctx = createMockContext({
			variant: {
				get: () => existing,
				upsert: () => {},
			} as never,
		});

		const result = await updateVariant({
			variantId: existing.id,
			model: null,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.model).toBeNull();
		}
	});

	test("returns NOT_FOUND for non-existent variant", async () => {
		const ctx = createMockContext({
			variant: { get: () => null } as never,
		});

		const result = await updateVariant({
			variantId: "non-existent",
			name: "X",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Variant not found");
		}
	});
});

// ============================================
// deleteVariant
// ============================================

describe("deleteVariant", () => {
	test("deletes an existing variant", async () => {
		const existing = createTestVariant();
		let deletedId: string | null = null;

		const ctx = createMockContext({
			variant: {
				get: () => existing,
				delete: (spec: { id?: string }) => {
					if ("id" in spec) deletedId = spec.id ?? null;
					return 1;
				},
			} as never,
		});

		const result = await deleteVariant({ variantId: existing.id }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
		// biome-ignore lint/style/noNonNullAssertion: test assertion after mock capture
		expect(deletedId!).toBe(existing.id);
	});

	test("returns NOT_FOUND for non-existent variant", async () => {
		const ctx = createMockContext({
			variant: { get: () => null } as never,
		});

		const result = await deleteVariant({ variantId: "non-existent" }).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});
});
