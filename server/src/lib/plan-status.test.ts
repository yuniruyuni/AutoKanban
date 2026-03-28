import { describe, expect, test } from "bun:test";
import {
	PLAN_APPROVAL_PATTERN,
	PLAN_REJECTION_PATTERN,
	computeDefaultPlanStatus,
	determinePlanStatusFromText,
} from "./plan-status";

describe("determinePlanStatusFromText", () => {
	test("detects plan approval", () => {
		expect(determinePlanStatusFromText(PLAN_APPROVAL_PATTERN)).toBe(
			"approved",
		);
	});

	test("detects plan rejection", () => {
		expect(
			determinePlanStatusFromText(
				`${PLAN_REJECTION_PATTERN} it's not good enough`,
			),
		).toBe("rejected");
	});

	test("detects plan rejection (exact pattern)", () => {
		expect(determinePlanStatusFromText(PLAN_REJECTION_PATTERN)).toBe(
			"rejected",
		);
	});

	test("returns null for unrelated messages", () => {
		expect(determinePlanStatusFromText("hello")).toBeNull();
		expect(determinePlanStatusFromText("")).toBeNull();
		expect(determinePlanStatusFromText("approved")).toBeNull();
	});

	test("does not match partial approval pattern", () => {
		expect(
			determinePlanStatusFromText("Please proceed with the plan. Also..."),
		).toBeNull();
	});
});

describe("computeDefaultPlanStatus", () => {
	test("denied tool → rejected plan", () => {
		expect(computeDefaultPlanStatus("denied")).toBe("rejected");
	});

	test("pending_approval tool → pending plan", () => {
		expect(computeDefaultPlanStatus("pending_approval")).toBe("pending");
	});

	test("running tool → pending plan", () => {
		expect(computeDefaultPlanStatus("running")).toBe("pending");
	});

	test("success tool → pending plan", () => {
		expect(computeDefaultPlanStatus("success")).toBe("pending");
	});

	test("failed tool → pending plan", () => {
		expect(computeDefaultPlanStatus("failed")).toBe("pending");
	});

	test("timed_out tool → pending plan", () => {
		expect(computeDefaultPlanStatus("timed_out")).toBe("pending");
	});
});
