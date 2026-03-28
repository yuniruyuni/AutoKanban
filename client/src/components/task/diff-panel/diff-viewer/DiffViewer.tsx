import { Columns2, FileCode, List } from "lucide-react";
import { useState } from "react";
import type { GitDiff } from "@/hooks/useGit";
import { cn } from "@/lib/utils";
import { FileDiffContent } from "./FileDiffContent";

interface DiffViewerProps {
	workspaceId: string;
	projectId: string;
	filePath: string;
	diff?: GitDiff;
	viewMode: "unified" | "side-by-side";
	onViewModeChange: (mode: "unified" | "side-by-side") => void;
}

export function DiffViewer({
	workspaceId,
	projectId,
	filePath,
	diff,
	viewMode,
	onViewModeChange,
}: DiffViewerProps) {
	const [hideWhitespace, setHideWhitespace] = useState(false);

	return (
		<div className="flex h-full flex-col">
			{/* File header - matches design: padding [12,20], border bottom, white bg */}
			<div className="flex items-center justify-between border-b border-[#E4E4E7] bg-white px-5 py-3">
				<div className="flex items-center gap-2">
					<FileCode className="h-4 w-4 text-[#E87B35]" />
					<span className="text-[13px] font-semibold text-[#0A0A0B]">
						{filePath}
					</span>
				</div>
				{diff && (
					<div className="flex items-center gap-2">
						<span className="font-mono text-xs font-semibold text-[#22C55E]">
							+{diff.additions}
						</span>
						<span className="font-mono text-xs font-semibold text-[#EF4444]">
							-{diff.deletions}
						</span>
					</div>
				)}
			</div>

			{/* Toolbar - matches design: bg-[#F5F5F5], padding [8,20], border bottom */}
			<div className="flex items-center justify-between border-b border-[#E4E4E7] bg-[#F5F5F5] px-5 py-2">
				{/* View mode toggle - rounded-sm with border */}
				<div className="flex items-center overflow-hidden rounded-sm border border-[#E4E4E7]">
					<button
						type="button"
						onClick={() => onViewModeChange("unified")}
						className={cn(
							"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
							viewMode === "unified"
								? "bg-[#E87B35] text-white"
								: "bg-white text-[#71717A] hover:bg-[#F5F5F5]",
						)}
					>
						<List className="h-3.5 w-3.5" />
						Unified
					</button>
					<button
						type="button"
						onClick={() => onViewModeChange("side-by-side")}
						className={cn(
							"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
							viewMode === "side-by-side"
								? "bg-[#E87B35] text-white"
								: "bg-white text-[#71717A] hover:bg-[#F5F5F5]",
						)}
					>
						<Columns2 className="h-3.5 w-3.5" />
						Side-by-side
					</button>
				</div>

				{/* Options - checkbox style whitespace toggle */}
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setHideWhitespace(!hideWhitespace)}
						className="flex items-center gap-1.5 rounded-sm bg-[#EBEBEB] px-2.5 py-1.5 text-xs font-medium text-[#71717A] transition-colors hover:opacity-80"
					>
						<div
							className={cn(
								"h-3.5 w-3.5 rounded-[3px] border border-[#E4E4E7]",
								hideWhitespace ? "bg-[#E87B35]" : "bg-white",
							)}
						/>
						Hide whitespace
					</button>
				</div>
			</div>

			{/* Diff content */}
			<div className="flex-1 overflow-auto">
				<FileDiffContent
					workspaceId={workspaceId}
					projectId={projectId}
					filePath={filePath}
					viewMode={viewMode}
					hideWhitespace={hideWhitespace}
				/>
			</div>
		</div>
	);
}
