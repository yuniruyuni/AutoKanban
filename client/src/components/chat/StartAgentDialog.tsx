import { ChevronDown, GitBranch } from "lucide-react";
import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/atoms/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
} from "@/components/atoms/Dialog";
import { useBranches } from "@/hooks/useBranches";
import { useStartExecution } from "@/hooks/useStartExecution";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { useVariants } from "@/hooks/useVariants";
import { executionActions, uiActions, uiStore } from "@/store";

const AGENT_OPTIONS = [{ value: "claude-code", label: "Claude Code" }];

export function StartAgentDialog() {
	const uiState = useSnapshot(uiStore);
	const { branches, isLoading: branchesLoading } = useBranches(
		uiState.startAgentProjectId,
	);
	const { startExecution, isStarting } = useStartExecution();
	const { updateTask } = useTaskMutations();

	const [agent, setAgent] = useState("claude-code");
	const { variants, isLoading: variantsLoading } = useVariants(agent);
	const [variant, setVariant] = useState("");
	const [baseBranch, setBaseBranch] = useState("");

	// Set default branch when branches load
	useEffect(() => {
		if (branches.length > 0 && !baseBranch) {
			// Prefer current branch, otherwise first branch
			const currentBranch = branches.find((b) => b.isCurrent);
			setBaseBranch(currentBranch?.name ?? branches[0].name);
		}
	}, [branches, baseBranch]);

	// Set default variant when variants load
	useEffect(() => {
		if (variants.length > 0 && !variant) {
			setVariant(variants[0].name);
		}
	}, [variants, variant]);

	// Reset state when dialog closes
	useEffect(() => {
		if (!uiState.isStartAgentDialogOpen) {
			setAgent("claude-code");
			setVariant("");
			setBaseBranch("");
		}
	}, [uiState.isStartAgentDialogOpen]);

	const handleStartExecution = async () => {
		if (!uiState.startAgentTaskId || !baseBranch) return;

		const taskId = uiState.startAgentTaskId;
		console.log("[StartAgentDialog] Starting execution for task:", taskId);

		try {
			// Start execution
			const result = await startExecution({
				taskId,
				executor: agent,
				variant: variant,
				targetBranch: baseBranch,
			});

			console.log("[StartAgentDialog] Execution started:", result);

			// Task status is now updated to inprogress on the server side atomically

			// Track the execution
			executionActions.startExecution(
				taskId,
				result.executionProcessId,
				result.sessionId,
				result.workspaceId,
			);

			console.log("[StartAgentDialog] UI store updated with execution info:", {
				taskId,
				executionProcessId: result.executionProcessId,
				sessionId: result.sessionId,
				workspaceId: result.workspaceId,
			});

			// Close the dialog
			uiActions.closeStartAgentDialog();
		} catch (error) {
			console.error("[StartAgentDialog] Failed to start execution:", error);
		}
	};

	const branchOptions = branches.map((b) => ({
		value: b.name,
		label: b.isCurrent ? `${b.name} (current)` : b.name,
	}));

	const handleStartWithoutAgent = async () => {
		if (!uiState.startAgentTaskId) return;
		const taskId = uiState.startAgentTaskId;

		try {
			await updateTask({
				taskId,
				status: "inprogress",
			});
			uiActions.closeStartAgentDialog();
		} catch (error) {
			console.error("[StartAgentDialog] Failed to start without agent:", error);
		}
	};

	return (
		<Dialog
			open={uiState.isStartAgentDialogOpen}
			onClose={() => uiActions.closeStartAgentDialog()}
			width={520}
		>
			<DialogHeader
				subtitle="Configure and start the agent for this task"
				onClose={() => uiActions.closeStartAgentDialog()}
				size="md"
			>
				Start Agent Execution
			</DialogHeader>

			<DialogContent>
				{/* Agent Field */}
				<div className="flex flex-col gap-2">
					<label
						htmlFor="start-agent-agent"
						className="block text-sm font-medium text-primary-foreground"
					>
						Agent
					</label>
					<div className="relative">
						<select
							id="start-agent-agent"
							value={agent}
							onChange={(e) => setAgent(e.target.value)}
							className="flex h-10 w-full appearance-none rounded-md border border-border bg-primary px-3 pr-8 text-sm text-primary-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
						>
							{AGENT_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
					</div>
				</div>

				{/* Configuration Variant Field */}
				<div className="flex flex-col gap-2">
					<label
						htmlFor="start-agent-variant"
						className="block text-sm font-medium text-primary-foreground"
					>
						Configuration Variant
					</label>
					<div className="relative">
						<select
							id="start-agent-variant"
							value={variant}
							onChange={(e) => setVariant(e.target.value)}
							disabled={variantsLoading || variants.length === 0}
							className="flex h-10 w-full appearance-none rounded-md border border-border bg-primary px-3 pr-8 text-sm text-primary-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{variantsLoading ? (
								<option value="">Loading variants...</option>
							) : variants.length === 0 ? (
								<option value="">No variants configured</option>
							) : (
								variants.map((v) => (
									<option key={v.id} value={v.name}>
										{v.name}
									</option>
								))
							)}
						</select>
						<ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
					</div>
				</div>

				{/* Base Branch Field */}
				<div className="flex flex-col gap-2">
					<label
						htmlFor="start-agent-branch"
						className="block text-sm font-medium text-primary-foreground"
					>
						Base Branch
					</label>
					<p className="text-xs text-muted">
						The branch to create the working branch from
					</p>
					<div className="relative">
						<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
							<GitBranch className="h-4 w-4 text-muted" />
						</div>
						<select
							id="start-agent-branch"
							value={baseBranch}
							onChange={(e) => setBaseBranch(e.target.value)}
							disabled={branchesLoading || branches.length === 0}
							className="flex h-10 w-full appearance-none rounded-md border border-border bg-primary py-2 pl-9 pr-8 text-sm text-primary-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{branchesLoading ? (
								<option value="">Loading branches...</option>
							) : branches.length === 0 ? (
								<option value="">No branches found</option>
							) : (
								branchOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))
							)}
						</select>
						<ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
					</div>
				</div>
			</DialogContent>

			<DialogFooter className="justify-between">
				<button
					type="button"
					onClick={handleStartWithoutAgent}
					className="text-sm font-medium text-secondary-foreground hover:text-primary-foreground px-4 py-2.5 rounded-md transition-colors"
				>
					Start without Agent
				</button>
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						onClick={() => uiActions.closeStartAgentDialog()}
					>
						Cancel
					</Button>
					<Button
						onClick={handleStartExecution}
						disabled={isStarting || !baseBranch || branchesLoading}
					>
						{isStarting ? "Starting..." : "Start Execution"}
					</Button>
				</div>
			</DialogFooter>
		</Dialog>
	);
}
