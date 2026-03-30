import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
} from "@/components/atoms/Dialog";
import { useDraftPRStream, useGitMutations } from "@/hooks/useGit";

interface CreatePRDialogProps {
	open: boolean;
	onClose: () => void;
	workspaceId: string;
	projectId: string;
	taskTitle: string;
	draft?: boolean;
}

export function CreatePRDialog({
	open,
	onClose,
	workspaceId,
	projectId,
	taskTitle,
	draft,
}: CreatePRDialogProps) {
	const { generatePRDescription, createPR, isCreatingPR } = useGitMutations();
	const [error, setError] = useState<string | null>(null);
	const hasStartedRef = useRef(false);

	// Only connect SSE when dialog is open
	const activeWorkspaceId = open ? workspaceId : null;
	const activeProjectId = open ? projectId : null;
	const { status, title, body, logs } = useDraftPRStream(
		activeWorkspaceId,
		activeProjectId,
	);

	const logContainerRef = useRef<HTMLDivElement>(null);

	// Auto-scroll logs when new content arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: logs triggers scroll to bottom
	useEffect(() => {
		if (logContainerRef.current) {
			logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
		}
	}, [logs]);

	const startGeneration = useCallback(async () => {
		try {
			setError(null);
			hasStartedRef.current = true;
			await generatePRDescription(workspaceId, projectId);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to generate PR description",
			);
		}
	}, [generatePRDescription, workspaceId, projectId]);

	// Start generation when dialog opens
	useEffect(() => {
		if (open && !hasStartedRef.current) {
			startGeneration();
		}
		if (!open) {
			hasStartedRef.current = false;
		}
	}, [open, startGeneration]);

	const handleRetry = () => {
		setError(null);
		hasStartedRef.current = false;
		startGeneration();
	};

	const handleCreatePR = async () => {
		try {
			setError(null);
			await createPR(workspaceId, projectId, title ?? taskTitle, draft);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create PR");
		}
	};

	const isGenerating = status === "generating" || status === null;
	const isCompleted = status === "completed";
	const isFailed = status === "failed" || error != null;

	return (
		<Dialog open={open} onClose={onClose} width={640}>
			<DialogHeader onClose={onClose}>Create Pull Request</DialogHeader>
			<DialogContent>
				{/* Status indicator */}
				<div className="flex items-center gap-2 text-sm">
					{isGenerating && !isFailed && (
						<>
							<Loader2 className="h-4 w-4 animate-spin text-accent" />
							<span className="text-secondary-foreground">
								Generating PR description...
							</span>
						</>
					)}
					{isCompleted && !isFailed && (
						<span className="text-green-600 font-medium">
							PR description generated
						</span>
					)}
					{isFailed && (
						<span className="text-red-600 font-medium">
							{error ?? "Generation failed"}
						</span>
					)}
				</div>

				{/* Log area */}
				{(isGenerating || logs) && (
					<div
						ref={logContainerRef}
						className="bg-gray-900 text-green-400 font-mono text-xs p-3 rounded overflow-y-auto max-h-64 whitespace-pre-wrap min-h-[4rem]"
					>
						{logs || "Waiting for output..."}
					</div>
				)}

				{/* Title and body preview */}
				{isCompleted && title && (
					<div className="space-y-3">
						<div>
							<p className="text-sm font-medium text-secondary-foreground mb-1">
								Title
							</p>
							<div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-primary-foreground">
								{title}
							</div>
						</div>
						{body && (
							<div>
								<p className="text-sm font-medium text-secondary-foreground mb-1">
									Description
								</p>
								<div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
									{body}
								</div>
							</div>
						)}
					</div>
				)}
			</DialogContent>
			<DialogFooter>
				<Button variant="outline" onClick={onClose}>
					Cancel
				</Button>
				{isFailed && (
					<Button onClick={handleRetry}>
						<RefreshCw className="mr-1.5 h-4 w-4" />
						Retry
					</Button>
				)}
				{isCompleted && !isFailed && (
					<Button onClick={handleCreatePR} disabled={isCreatingPR}>
						{isCreatingPR ? "Creating..." : "Create PR"}
					</Button>
				)}
			</DialogFooter>
		</Dialog>
	);
}
