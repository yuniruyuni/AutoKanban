import { useState } from "react";
import { useDiffs } from "@/hooks/useGit";
import { buildFileTree } from "@/lib/diff-parser";
import { DiffViewer } from "./diff-viewer/DiffViewer";
import { FileTreeView } from "./file-tree/FileTreeView";

interface DiffPanelProps {
	workspaceId: string | null;
	projectId: string | null;
}

export function DiffPanel({ workspaceId, projectId }: DiffPanelProps) {
	const { diffs, totalAdditions, totalDeletions, isLoading } = useDiffs(
		workspaceId,
		projectId,
	);
	const [viewMode, setViewMode] = useState<"unified" | "side-by-side">(
		"unified",
	);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);

	if (!workspaceId || !projectId) {
		return (
			<div className="flex h-full items-center justify-center text-muted">
				No workspace selected
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center text-muted">
				Loading diffs...
			</div>
		);
	}

	// Build a directory tree from flat file list
	const fileTree = buildFileTree(diffs);

	// Auto-select first file if none selected
	const activeFile =
		selectedFile ?? (diffs.length > 0 ? diffs[0].filePath : null);

	return (
		<div className="flex h-full">
			{/* Left pane - File tree - matches design: width 280, white bg, right border */}
			<div className="flex w-[280px] flex-shrink-0 flex-col border-r border-[#E4E4E7] bg-white">
				{/* Tree header - matches design: padding 16, gap 8, border bottom */}
				<div className="space-y-2 border-b border-[#E4E4E7] p-4">
					<div className="flex items-center justify-between">
						<span className="text-[13px] font-semibold text-[#0A0A0B]">
							Changed files
						</span>
						<span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-medium text-[#71717A]">
							{diffs.length}
						</span>
					</div>
					<div className="flex items-center gap-3">
						<span className="font-mono text-[11px] font-semibold text-[#22C55E]">
							+{totalAdditions}
						</span>
						<span className="font-mono text-[11px] font-semibold text-[#EF4444]">
							-{totalDeletions}
						</span>
					</div>
				</div>

				{/* File tree items */}
				<div className="flex-1 overflow-y-auto py-2">
					{diffs.length === 0 ? (
						<div className="flex h-32 items-center justify-center text-sm text-[#A1A1AA]">
							No changes
						</div>
					) : (
						<FileTreeView
							tree={fileTree}
							selectedFile={activeFile}
							onSelectFile={setSelectedFile}
							diffs={diffs}
						/>
					)}
				</div>
			</div>

			{/* Right pane - Diff viewer - white bg */}
			<div className="flex flex-1 flex-col overflow-hidden bg-white">
				{activeFile ? (
					<DiffViewer
						workspaceId={workspaceId}
						projectId={projectId}
						filePath={activeFile}
						diff={diffs.find((d) => d.filePath === activeFile)}
						viewMode={viewMode}
						onViewModeChange={setViewMode}
					/>
				) : (
					<div className="flex h-full items-center justify-center text-sm text-[#A1A1AA]">
						Select a file to view changes
					</div>
				)}
			</div>
		</div>
	);
}
