import { AlertTriangle, GitBranch, Trash2 } from "lucide-react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/atoms/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
} from "@/components/atoms/Dialog";
import { uiActions, uiStore } from "@/store";

export function ConfirmDialog() {
	const uiState = useSnapshot(uiStore);
	const dialogType = uiState.confirmDialogType;

	const getActionLabel = () => {
		switch (dialogType) {
			case "stop-and-reset":
				return "Reset Task";
			case "reset":
				return "Reset Task";
			case "stop":
				return "Stop Agent";
			case "resume":
				return "Resume Agent";
			case "delete-project":
				return "Delete Project";
			default:
				return "Confirm";
		}
	};

	const getActionVariant = (): "destructive" | "warning" | "accent" => {
		switch (dialogType) {
			case "stop-and-reset":
				return "destructive";
			case "reset":
				return "destructive";
			case "stop":
				return "warning";
			case "resume":
				return "accent";
			case "delete-project":
				return "destructive";
			default:
				return "destructive";
		}
	};

	const getDialogWidth = () => {
		if (dialogType === "resume") return 520;
		if (dialogType === "delete-project") return 520;
		return 480;
	};

	return (
		<Dialog
			open={uiState.isConfirmDialogOpen}
			onClose={() => uiActions.closeConfirmDialog()}
			width={getDialogWidth()}
		>
			<DialogHeader
				onClose={() => uiActions.closeConfirmDialog()}
				subtitle={uiState.confirmDialogMessage}
			>
				{uiState.confirmDialogTitle}
			</DialogHeader>
			<DialogContent>
				{dialogType === "stop-and-reset" && (
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
							<span className="text-sm text-primary-foreground">
								The agent will be stopped
							</span>
						</div>
						<div className="flex items-center gap-3">
							<Trash2 className="h-5 w-5 flex-shrink-0 text-destructive" />
							<span className="text-sm text-primary-foreground">
								All chat history will be permanently deleted
							</span>
						</div>
					</div>
				)}
				{dialogType === "reset" && (
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<Trash2 className="h-5 w-5 flex-shrink-0 text-destructive" />
							<span className="text-sm text-primary-foreground">
								All chat history will be permanently deleted
							</span>
						</div>
					</div>
				)}
				{dialogType === "stop" && (
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
							<span className="text-sm text-primary-foreground">
								The agent will be stopped. Chat history will be preserved.
							</span>
						</div>
					</div>
				)}
				{dialogType === "resume" && (
					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium text-primary-foreground">
							Message
						</span>
						<textarea
							className="w-full h-[120px] rounded-md border border-border bg-primary p-3.5 text-sm text-primary-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-1 focus:ring-border"
							placeholder="Fix the failing tests and update the documentation..."
							value={uiState.confirmDialogInput}
							onChange={(e) => uiActions.setConfirmDialogInput(e.target.value)}
						/>
					</div>
				)}
				{dialogType === "delete-project" && (
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
							<span className="text-sm text-primary-foreground">
								All tasks, chat history, and execution data will be deleted
							</span>
						</div>
						<div className="flex items-center gap-3">
							<GitBranch className="h-5 w-5 flex-shrink-0 text-success" />
							<span className="text-sm text-primary-foreground">
								The original Git repository will NOT be deleted
							</span>
						</div>
						<label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
							<input
								type="checkbox"
								className="mt-0.5 h-4 w-4 rounded border-border"
								checked={uiState.confirmDialogCheckbox}
								onChange={(e) =>
									uiActions.setConfirmDialogCheckbox(e.target.checked)
								}
							/>
							<div className="flex flex-col gap-0.5">
								<span className="text-sm text-primary-foreground">
									Also delete worktree directories
								</span>
								<span className="text-xs text-secondary-foreground">
									Removes workspace worktree folders from
									~/.auto-kanban/worktrees/
								</span>
							</div>
						</label>
					</div>
				)}
				{dialogType === "confirm" && (
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
							<span className="text-sm text-primary-foreground">
								This action cannot be undone
							</span>
						</div>
					</div>
				)}
			</DialogContent>
			<DialogFooter>
				<Button
					variant="outline"
					onClick={() => uiActions.closeConfirmDialog()}
				>
					Cancel
				</Button>
				<Button
					variant={getActionVariant()}
					onClick={() => uiActions.confirmAction()}
				>
					{getActionLabel()}
				</Button>
			</DialogFooter>
		</Dialog>
	);
}
