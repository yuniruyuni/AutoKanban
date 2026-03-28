import { ArrowLeft, Folder, FolderGit, GitBranch } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileBrowser } from "@/components/project/FileBrowser";
import { SidebarLayout } from "@/components/project/SidebarLayout";
import { type DirectoryEntry, useGitInfo } from "@/hooks/useDirectoryBrowser";
import { useProjectMutations } from "@/hooks/useProjects";
import { paths } from "@/lib/paths";
import { trpc } from "@/trpc";

export function NewProjectPage() {
	const navigate = useNavigate();
	const [selectedEntry, setSelectedEntry] = useState<DirectoryEntry | null>(
		null,
	);
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const { gitInfo, initGitRepo, isInitializing, refetch } = useGitInfo(
		selectedEntry?.path ?? null,
	);
	const { createProject } = useProjectMutations();
	const initCommitMutation = trpc.project.initCommit.useMutation();

	const handleSelect = useCallback((entry: DirectoryEntry) => {
		setSelectedEntry(entry);
		setCreateError(null);
	}, []);

	const handleInitGit = async () => {
		if (!selectedEntry) return;

		try {
			await initGitRepo("main");
			await refetch();
		} catch (error) {
			console.error("Failed to initialize git repository:", error);
		}
	};

	const handleInitCommit = async () => {
		if (!selectedEntry) return;

		try {
			await initCommitMutation.mutateAsync({ path: selectedEntry.path });
			await refetch();
		} catch (error) {
			console.error("Failed to create initial commit:", error);
		}
	};

	const handleCreate = async () => {
		if (!selectedEntry || !gitInfo?.isGitRepo) return;

		setIsCreating(true);
		setCreateError(null);
		try {
			await createProject({
				name: gitInfo.repoName ?? selectedEntry.name,
				repoPath: selectedEntry.path,
				branch: gitInfo.currentBranch ?? "main",
			});
			navigate(paths.home());
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create project";
			setCreateError(message);
		} finally {
			setIsCreating(false);
		}
	};

	const handleCancel = () => {
		navigate(paths.home());
	};

	const canCreate =
		selectedEntry && gitInfo?.isGitRepo && gitInfo?.hasCommits && !isCreating;

	return (
		<SidebarLayout>
			<div className="flex flex-col h-full py-8 px-10 gap-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={handleCancel}
						className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary border border-border hover:bg-hover transition-colors"
					>
						<ArrowLeft className="w-4 h-4 text-secondary-foreground" />
					</button>
					<div className="flex flex-col gap-1">
						<h1 className="text-2xl font-bold text-primary-foreground">
							New Project
						</h1>
						<p className="text-sm font-normal text-secondary-foreground">
							Select a git repository or directory to create a project
						</p>
					</div>
				</div>

				{/* Browser section */}
				<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
					<FileBrowser
						onSelect={handleSelect}
						selectedPath={selectedEntry?.path ?? null}
					/>
				</div>

				{/* Selected section */}
				{selectedEntry && (
					<div className="flex flex-col gap-3">
						<span
							className="text-xs font-semibold text-muted uppercase"
							style={{ letterSpacing: "0.5px" }}
						>
							{gitInfo?.isGitRepo
								? "Selected Repository"
								: "Selected Directory"}
						</span>

						{gitInfo?.isGitRepo ? (
							<div className="flex flex-col gap-2">
								<div className="flex items-center gap-4 p-4 bg-secondary border-2 border-accent rounded-md">
									<div className="w-10 h-10 flex items-center justify-center bg-accent rounded-md">
										<GitBranch className="w-5 h-5 text-white" />
									</div>
									<div className="flex-1 flex flex-col gap-1">
										<span className="text-base font-semibold text-primary-foreground">
											{gitInfo.repoName ?? selectedEntry.name}
										</span>
										<span className="text-xs font-mono text-muted">
											{selectedEntry.path}
										</span>
									</div>
									<div className="flex items-center gap-1.5">
										<GitBranch className="w-3 h-3 text-muted" />
										<span className="text-xs font-mono text-secondary-foreground">
											{gitInfo.currentBranch ?? "main"}
										</span>
									</div>
								</div>
								{!gitInfo.hasCommits && (
									<div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/30 rounded-md">
										<span className="text-xs text-warning flex-1">
											This repository has no commits yet. An initial commit is
											required before creating a project.
										</span>
										<button
											type="button"
											onClick={handleInitCommit}
											disabled={initCommitMutation.isPending}
											className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
										>
											{initCommitMutation.isPending
												? "Committing..."
												: "Create Initial Commit"}
										</button>
									</div>
								)}
							</div>
						) : (
							<div className="flex items-center gap-4 p-4 bg-secondary border-2 border-warning rounded-md">
								<div className="w-10 h-10 flex items-center justify-center bg-warning rounded-md">
									<Folder className="w-5 h-5 text-white" />
								</div>
								<div className="flex-1 flex flex-col gap-1">
									<span className="text-base font-semibold text-primary-foreground">
										{selectedEntry.name}
									</span>
									<span className="text-xs font-mono text-muted">
										{selectedEntry.path}
									</span>
									<span className="text-xs text-warning">
										Not a git repository
									</span>
								</div>
								<button
									type="button"
									onClick={handleInitGit}
									disabled={isInitializing}
									className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
								>
									<FolderGit className="w-4 h-4" />
									{isInitializing ? "Initializing..." : "Initialize Git"}
								</button>
							</div>
						)}
					</div>
				)}

				{/* Error message */}
				{createError && (
					<div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
						<p className="text-xs text-destructive">{createError}</p>
					</div>
				)}

				{/* Footer */}
				<div className="flex items-center justify-end gap-3">
					<button
						type="button"
						onClick={handleCancel}
						className="flex items-center justify-center rounded-md bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-hover transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleCreate}
						disabled={!canCreate}
						className="flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isCreating ? "Creating..." : "Create Project"}
					</button>
				</div>
			</div>
		</SidebarLayout>
	);
}
