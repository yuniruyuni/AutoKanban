import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestVariant } from "../../test/factories";
import { createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import { Variant } from "../models/variant";
import { VariantRepository } from "./variant";

let db: Database;
let variantRepo: VariantRepository;

beforeEach(() => {
	db = createTestDB();
	variantRepo = new VariantRepository(db);
});

afterEach(() => {
	db.close();
});

// ============================================
// upsert + get
// ============================================

describe("VariantRepository upsert + get", () => {
	test("inserts and retrieves a variant", () => {
		const variant = createTestVariant();
		variantRepo.upsert(variant);

		const retrieved = variantRepo.get(Variant.ById(variant.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(variant.id);
		expect(retrieved?.executor).toBe("claude-code");
		expect(retrieved?.name).toBe("TEST");
		expect(retrieved?.permissionMode).toBe("bypassPermissions");
	});

	test("updates existing variant on conflict", () => {
		const variant = createTestVariant();
		variantRepo.upsert(variant);

		const updated = {
			...variant,
			name: "UPDATED",
			permissionMode: "plan",
			updatedAt: new Date(),
		};
		variantRepo.upsert(updated);

		const retrieved = variantRepo.get(Variant.ById(variant.id));
		expect(retrieved?.name).toBe("UPDATED");
		expect(retrieved?.permissionMode).toBe("plan");
	});

	test("preserves null model and appendPrompt", () => {
		const variant = createTestVariant({ model: null, appendPrompt: null });
		variantRepo.upsert(variant);

		const retrieved = variantRepo.get(Variant.ById(variant.id));
		expect(retrieved?.model).toBeNull();
		expect(retrieved?.appendPrompt).toBeNull();
	});

	test("stores and retrieves model and appendPrompt", () => {
		const variant = createTestVariant({
			model: "opus",
			appendPrompt: "Be concise",
		});
		variantRepo.upsert(variant);

		const retrieved = variantRepo.get(Variant.ById(variant.id));
		expect(retrieved?.model).toBe("opus");
		expect(retrieved?.appendPrompt).toBe("Be concise");
	});

	test("returns null for non-existent id", () => {
		const retrieved = variantRepo.get(Variant.ById("non-existent"));
		expect(retrieved).toBeNull();
	});

	test("round-trip preserves all fields", () => {
		const variant = createTestVariant({
			model: "sonnet",
			appendPrompt: "Extra instructions",
		});
		variantRepo.upsert(variant);

		const retrieved = variantRepo.get(Variant.ById(variant.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Variant, variant, [
			"createdAt",
			"updatedAt",
		]);
	});
});

// ============================================
// Spec-based queries
// ============================================

describe("VariantRepository spec queries", () => {
	test("ByExecutor filters by executor", () => {
		const v1 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		const v2 = createTestVariant({ executor: "claude-code", name: "PLAN" });
		const v3 = createTestVariant({ executor: "gemini-cli", name: "DEFAULT" });
		variantRepo.upsert(v1);
		variantRepo.upsert(v2);
		variantRepo.upsert(v3);

		const page = variantRepo.list(Variant.ByExecutor("claude-code"), {
			limit: 50,
		});
		expect(page.items).toHaveLength(2);
		expect(page.items.every((v) => v.executor === "claude-code")).toBe(true);
	});

	test("ByExecutorAndName finds exact match", () => {
		const v1 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		const v2 = createTestVariant({ executor: "claude-code", name: "PLAN" });
		variantRepo.upsert(v1);
		variantRepo.upsert(v2);

		const retrieved = variantRepo.get(
			Variant.ByExecutorAndName("claude-code", "PLAN"),
		);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(v2.id);
	});

	test("ByExecutorAndName returns null when no match", () => {
		const v1 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		variantRepo.upsert(v1);

		const retrieved = variantRepo.get(
			Variant.ByExecutorAndName("claude-code", "NON_EXISTENT"),
		);
		expect(retrieved).toBeNull();
	});

	test("ByExecutorAndName distinguishes different executors", () => {
		const v1 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		const v2 = createTestVariant({ executor: "gemini-cli", name: "DEFAULT" });
		variantRepo.upsert(v1);
		variantRepo.upsert(v2);

		const retrieved = variantRepo.get(
			Variant.ByExecutorAndName("gemini-cli", "DEFAULT"),
		);
		expect(retrieved?.id).toBe(v2.id);
	});
});

// ============================================
// listByExecutor
// ============================================

describe("VariantRepository listByExecutor", () => {
	test("returns all variants for an executor", () => {
		const v1 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		const v2 = createTestVariant({ executor: "claude-code", name: "PLAN" });
		const v3 = createTestVariant({ executor: "gemini-cli", name: "DEFAULT" });
		variantRepo.upsert(v1);
		variantRepo.upsert(v2);
		variantRepo.upsert(v3);

		const variants = variantRepo.listByExecutor("claude-code");
		expect(variants).toHaveLength(2);
	});

	test("returns empty array for unknown executor", () => {
		const variants = variantRepo.listByExecutor("unknown-executor");
		expect(variants).toHaveLength(0);
	});
});

// ============================================
// UNIQUE constraint
// ============================================

describe("VariantRepository UNIQUE constraint", () => {
	test("UNIQUE(executor, name) prevents duplicate entries", () => {
		const v1 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		variantRepo.upsert(v1);

		// Creating a different variant with same executor+name should fail on INSERT
		const v2 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		expect(() => variantRepo.upsert(v2)).toThrow();
	});

	test("same name with different executor is allowed", () => {
		const v1 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		const v2 = createTestVariant({ executor: "gemini-cli", name: "DEFAULT" });
		variantRepo.upsert(v1);
		variantRepo.upsert(v2);

		const all1 = variantRepo.listByExecutor("claude-code");
		const all2 = variantRepo.listByExecutor("gemini-cli");
		expect(all1).toHaveLength(1);
		expect(all2).toHaveLength(1);
	});
});

// ============================================
// Pagination
// ============================================

describe("VariantRepository pagination", () => {
	test("respects limit", () => {
		for (let i = 0; i < 5; i++) {
			const v = createTestVariant({
				executor: "claude-code",
				name: `VARIANT_${i}`,
			});
			variantRepo.upsert(v);
		}

		const page = variantRepo.list(Variant.ByExecutor("claude-code"), {
			limit: 3,
		});
		expect(page.items).toHaveLength(3);
		expect(page.hasMore).toBe(true);
		expect(page.nextCursor).toBeDefined();
	});

	test("hasMore is false when all items fit", () => {
		for (let i = 0; i < 3; i++) {
			const v = createTestVariant({
				executor: "claude-code",
				name: `VARIANT_${i}`,
			});
			variantRepo.upsert(v);
		}

		const page = variantRepo.list(Variant.ByExecutor("claude-code"), {
			limit: 10,
		});
		expect(page.items).toHaveLength(3);
		expect(page.hasMore).toBe(false);
		expect(page.nextCursor).toBeUndefined();
	});
});

// ============================================
// delete
// ============================================

describe("VariantRepository delete", () => {
	test("deletes a variant", () => {
		const variant = createTestVariant();
		variantRepo.upsert(variant);

		const deleted = variantRepo.delete(Variant.ById(variant.id));
		expect(deleted).toBe(1);
		expect(variantRepo.get(Variant.ById(variant.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", () => {
		const deleted = variantRepo.delete(Variant.ById("non-existent"));
		expect(deleted).toBe(0);
	});

	test("deletes all variants for an executor", () => {
		const v1 = createTestVariant({ executor: "claude-code", name: "DEFAULT" });
		const v2 = createTestVariant({ executor: "claude-code", name: "PLAN" });
		const v3 = createTestVariant({ executor: "gemini-cli", name: "DEFAULT" });
		variantRepo.upsert(v1);
		variantRepo.upsert(v2);
		variantRepo.upsert(v3);

		const deleted = variantRepo.delete(Variant.ByExecutor("claude-code"));
		expect(deleted).toBe(2);
		expect(variantRepo.listByExecutor("claude-code")).toHaveLength(0);
		expect(variantRepo.listByExecutor("gemini-cli")).toHaveLength(1);
	});
});
