import { LogViewer } from "@/components/chat/LogViewer";
import { useWorkspaceScript } from "@/hooks/useWorkspaceScript";
import { cn } from "@/lib/utils";

interface WorkspacePanelProps {
	taskId: string;
}

export function WorkspacePanel({ taskId }: WorkspacePanelProps) {
	const {
		logs,
		isStreaming,
		isRunning,
		lastScriptType,
		runPrepare,
		runCleanup,
	} = useWorkspaceScript(taskId);

	return (
		<div className="flex h-full flex-col gap-4 p-6">
			{/* Action bar */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={runPrepare}
					disabled={isRunning}
					className={cn(
						"rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
						isRunning
							? "cursor-not-allowed bg-[#E87B35]/50"
							: "bg-[#E87B35] hover:bg-[#F5924D]",
					)}
				>
					Prepare
				</button>
				<button
					type="button"
					onClick={runCleanup}
					disabled={isRunning}
					className={cn(
						"rounded-md border px-4 py-2 text-sm font-medium transition-colors",
						isRunning
							? "cursor-not-allowed border-[#E4E4E7] text-[#A1A1AA]"
							: "border-[#E4E4E7] text-[#71717A] hover:bg-[#F5F5F5]",
					)}
				>
					Cleanup
				</button>
				{lastScriptType && (
					<span
						className={cn(
							"rounded px-2 py-1 text-xs font-semibold",
							isRunning ? "bg-[#E87B35] text-white" : "bg-[#22C55E] text-white",
						)}
					>
						{isRunning ? "Running..." : "Completed"}
					</span>
				)}
				<div className="flex-1" />
				<span className="font-mono text-xs text-[#A1A1AA]">
					auto-kanban.json
				</span>
			</div>

			{/* Unified log viewer */}
			<div className="min-h-0 flex-1">
				{logs.length > 0 || isStreaming ? (
					<LogViewer logs={logs} isStreaming={isStreaming} className="h-full" />
				) : (
					<div className="flex h-full items-center justify-center rounded-md bg-[#1A1A2E]">
						<span className="font-mono text-sm text-[#52525B]">
							Click Prepare or Cleanup to run a workspace script
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
