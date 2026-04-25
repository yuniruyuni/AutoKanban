import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { BranchStatus } from "@/hooks/useGit";
import { GitOperationButtons } from "./GitOperationButtons";

const mockState = vi.hoisted(() => ({
	status: null as BranchStatus | null,
	isFinalizingPrMerge: false,
	finalizePrMerge:
		vi.fn<(workspaceId: string, projectId: string) => Promise<unknown>>(),
}));

vi.mock("@/hooks/useGit", () => ({
	useBranchStatus: () => ({
		status: mockState.status,
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useDiffs: () => ({
		diffs: [],
		totalAdditions: 0,
		totalDeletions: 0,
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useDraftPRStream: () => ({
		status: null,
		title: null,
		body: null,
		logs: "",
		isConnected: false,
	}),
	useFileDiff: () => ({
		diff: "",
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useGitMutations: () => ({
		rebase: vi.fn(),
		isRebasing: false,
		abortRebase: vi.fn(),
		isAbortingRebase: false,
		continueRebase: vi.fn(),
		isContinuingRebase: false,
		resolveRebaseConflict: vi.fn(),
		isResolvingRebaseConflict: false,
		merge: vi.fn(),
		isMerging: false,
		generatePRDescription: vi.fn(),
		isGeneratingPRDescription: false,
		createPR: vi.fn(),
		isCreatingPR: false,
		finalizePrMerge: mockState.finalizePrMerge,
		isFinalizingPrMerge: mockState.isFinalizingPrMerge,
	}),
}));

vi.mock("@/trpc", () => ({
	trpc: {
		git: {
			listBranches: {
				useQuery: () => ({ data: { branches: [] } }),
			},
			generatePRDescription: {
				useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
			},
			createPR: {
				useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
			},
		},
	},
}));

const baseStatus = (overrides: Partial<BranchStatus>): BranchStatus => ({
	branch: "feat/test",
	targetBranch: "main",
	isRebaseInProgress: false,
	isMergeInProgress: false,
	conflictOp: null,
	conflictedFiles: [],
	ahead: 0,
	behind: 0,
	lastCommitHash: null,
	lastCommitMessage: null,
	prUrl: "https://github.com/example/repo/pull/1",
	prState: null,
	...overrides,
});

const flushEffects = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
};

const renderComponent = (
	props: {
		taskStatus?: string;
		workspaceId?: string | null;
		projectId?: string | null;
	} = {},
) =>
	render(
		<GitOperationButtons
			workspaceId={props.workspaceId ?? "ws-1"}
			projectId={props.projectId ?? "p-1"}
			taskStatus={props.taskStatus}
			taskTitle="Test Task"
		/>,
	);

describe("GitOperationButtons auto-finalize", () => {
	beforeEach(() => {
		mockState.status = null;
		mockState.isFinalizingPrMerge = false;
		mockState.finalizePrMerge = vi.fn().mockResolvedValue({ success: true });
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	test("does not call finalize when prState is not merged", async () => {
		mockState.status = baseStatus({ prState: "open" });
		renderComponent({ taskStatus: "inreview" });
		await flushEffects();

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(0);
	});

	test("calls finalize exactly once when prState transitions to merged and stays cached as merged after success (flicker regression)", async () => {
		// Step A: initial render — PR open, no finalize yet.
		mockState.status = baseStatus({ prState: "open" });
		const { rerender } = renderComponent({ taskStatus: "inreview" });
		await flushEffects();

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(0);

		// Step B: poll detects merge — useEffect should fire finalize.
		mockState.status = baseStatus({ prState: "merged" });
		mockState.isFinalizingPrMerge = false;
		rerender(
			<GitOperationButtons
				workspaceId="ws-1"
				projectId="p-1"
				taskStatus="inreview"
				taskTitle="Test Task"
			/>,
		);
		await flushEffects();

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(1);

		// Step C: mutation is in-flight — isFinalizingPrMerge flips true.
		mockState.isFinalizingPrMerge = true;
		rerender(
			<GitOperationButtons
				workspaceId="ws-1"
				projectId="p-1"
				taskStatus="inreview"
				taskTitle="Test Task"
			/>,
		);
		await flushEffects();

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(1);

		// Step D: mutation succeeded. isFinalizingPrMerge flips back false.
		// The worktree is gone server-side, so a refetch of getBranchStatus
		// would fail and React Query keeps the last successful data — i.e.
		// status.prState stays "merged" in the cache. The buggy version
		// re-fires finalize here because finalizingRef is reset in `.finally()`.
		mockState.isFinalizingPrMerge = false;
		// status remains merged (stale cache simulation)
		rerender(
			<GitOperationButtons
				workspaceId="ws-1"
				projectId="p-1"
				taskStatus="inreview"
				taskTitle="Test Task"
			/>,
		);
		await flushEffects();

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(1);

		// Step E: simulate further refetch ticks landing on the same cached merged
		// state. Even multiple rerenders must not re-trigger finalize.
		for (let i = 0; i < 3; i++) {
			rerender(
				<GitOperationButtons
					workspaceId="ws-1"
					projectId="p-1"
					taskStatus="inreview"
					taskTitle="Test Task"
				/>,
			);
			await flushEffects();
		}

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(1);
	});

	test("does not call finalize when task is already done", async () => {
		mockState.status = baseStatus({ prState: "merged" });
		renderComponent({ taskStatus: "done" });
		await flushEffects();

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(0);
	});

	test("retries finalize after a failed attempt when isFinalizing flips back to false", async () => {
		mockState.finalizePrMerge = vi
			.fn<(workspaceId: string, projectId: string) => Promise<unknown>>()
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValue({ success: true });

		// Step A: PR merge detected, first attempt fires.
		mockState.status = baseStatus({ prState: "merged" });
		mockState.isFinalizingPrMerge = false;
		const { rerender } = renderComponent({ taskStatus: "inreview" });
		await flushEffects();

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(1);

		// Step B: production useMutation flips isPending → true while in-flight.
		mockState.isFinalizingPrMerge = true;
		rerender(
			<GitOperationButtons
				workspaceId="ws-1"
				projectId="p-1"
				taskStatus="inreview"
				taskTitle="Test Task"
			/>,
		);
		await flushEffects();

		// Step C: mutation finished (with rejection). isPending flips false.
		// finalizingRef must have been reset on error so the effect can retry.
		mockState.isFinalizingPrMerge = false;
		rerender(
			<GitOperationButtons
				workspaceId="ws-1"
				projectId="p-1"
				taskStatus="inreview"
				taskTitle="Test Task"
			/>,
		);
		await flushEffects();

		expect(mockState.finalizePrMerge).toHaveBeenCalledTimes(2);
	});

	test("renders 'PR Merged' badge when prState is merged and not finalizing", async () => {
		mockState.status = baseStatus({ prState: "merged" });
		mockState.isFinalizingPrMerge = false;
		renderComponent({ taskStatus: "done" });
		await flushEffects();

		expect(screen.getByText("PR Merged")).toBeInTheDocument();
		expect(screen.queryByText("Finalizing...")).not.toBeInTheDocument();
	});

	test("renders 'Finalizing...' badge when finalize mutation is pending", async () => {
		mockState.status = baseStatus({ prState: "merged" });
		mockState.isFinalizingPrMerge = true;
		renderComponent({ taskStatus: "inreview" });
		await flushEffects();

		expect(screen.getByText("Finalizing...")).toBeInTheDocument();
	});
});
