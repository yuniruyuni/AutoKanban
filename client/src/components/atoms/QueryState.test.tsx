import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { QueryState, Skeleton, SkeletonRows } from "./QueryState";

describe("QueryState", () => {
	test("renders children when not loading and no error", () => {
		render(
			<QueryState isLoading={false} error={null}>
				<div>content</div>
			</QueryState>,
		);
		expect(screen.getByText("content")).toBeInTheDocument();
	});

	test("renders default skeleton when loading", () => {
		render(
			<QueryState isLoading={true} error={null}>
				<div>content</div>
			</QueryState>,
		);
		expect(screen.queryByText("content")).not.toBeInTheDocument();
		expect(screen.getByTestId("query-state-loading")).toBeInTheDocument();
		expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
	});

	test("renders custom loadingFallback when provided", () => {
		render(
			<QueryState
				isLoading={true}
				error={null}
				loadingFallback={<div>custom-loading</div>}
			>
				<div>content</div>
			</QueryState>,
		);
		expect(screen.getByText("custom-loading")).toBeInTheDocument();
	});

	test("renders error message and retry button when error is set", () => {
		const onRetry = vi.fn();
		render(
			<QueryState
				isLoading={false}
				error={{ message: "boom" }}
				onRetry={onRetry}
			>
				<div>content</div>
			</QueryState>,
		);
		expect(screen.queryByText("content")).not.toBeInTheDocument();
		expect(screen.getByRole("alert")).toBeInTheDocument();
		expect(screen.getByText("boom")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	test("renders fallback message when error has no message", () => {
		render(
			<QueryState isLoading={false} error={{}}>
				<div>content</div>
			</QueryState>,
		);
		expect(screen.getByText("Failed to load data")).toBeInTheDocument();
	});

	test("does not render retry button when onRetry is not provided", () => {
		render(
			<QueryState isLoading={false} error={{ message: "boom" }}>
				<div>content</div>
			</QueryState>,
		);
		expect(
			screen.queryByRole("button", { name: "Retry" }),
		).not.toBeInTheDocument();
	});

	test("error takes priority over loading", () => {
		render(
			<QueryState isLoading={true} error={{ message: "boom" }}>
				<div>content</div>
			</QueryState>,
		);
		expect(screen.getByRole("alert")).toBeInTheDocument();
		expect(screen.queryByTestId("query-state-loading")).not.toBeInTheDocument();
	});
});

describe("Skeleton", () => {
	test("applies animate-pulse and merges className", () => {
		render(<Skeleton className="h-8 w-full" />);
		const el = screen.getByTestId("skeleton");
		expect(el).toHaveClass("animate-pulse");
		expect(el).toHaveClass("h-8");
		expect(el).toHaveClass("w-full");
	});
});

describe("SkeletonRows", () => {
	test("renders the requested number of skeletons", () => {
		render(<SkeletonRows count={5} />);
		expect(screen.getAllByTestId("skeleton")).toHaveLength(5);
	});

	test("defaults to 3 skeletons", () => {
		render(<SkeletonRows />);
		expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
	});
});
