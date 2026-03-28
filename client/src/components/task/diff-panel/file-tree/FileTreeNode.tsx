import {
	ChevronDown,
	ChevronRight,
	Folder,
	FolderOpen,
} from "lucide-react";
import { useState } from "react";
import type { GitDiff } from "@/hooks/useGit";
import type { TreeNode } from "@/lib/diff-parser";
import { cn } from "@/lib/utils";
import { FileStatusIcon } from "./FileStatusIcon";

interface FileTreeNodeProps {
	node: TreeNode;
	depth: number;
	selectedFile: string | null;
	onSelectFile: (path: string) => void;
	diffs: GitDiff[];
}

export function FileTreeNode({
	node,
	depth,
	selectedFile,
	onSelectFile,
	diffs,
}: FileTreeNodeProps) {
	const [isExpanded, setIsExpanded] = useState(true);
	const paddingLeft = 16 + depth * 16;

	if (node.isFile) {
		const diff = diffs.find((d) => d.filePath === node.path);
		const isSelected = selectedFile === node.path;

		return (
			<button
				type="button"
				onClick={() => onSelectFile(node.path)}
				className={cn(
					"flex w-full items-center gap-2 py-1.5 pr-4 text-left text-[13px] transition-colors hover:bg-[#F5F5F5]",
					isSelected && "bg-[#F5F5F5] font-medium",
				)}
				style={{ paddingLeft }}
			>
				<FileStatusIcon status={diff?.status} />
				<span
					className={cn(
						"truncate",
						isSelected ? "text-[#0A0A0B]" : "text-[#71717A]",
					)}
				>
					{node.name}
				</span>
			</button>
		);
	}

	// Directory node
	return (
		<div>
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex w-full items-center gap-1.5 py-1.5 pr-4 text-left text-[13px] text-[#71717A] hover:bg-[#F5F5F5] transition-colors"
				style={{ paddingLeft }}
			>
				{isExpanded ? (
					<>
						<ChevronDown className="h-3 w-3 text-muted flex-shrink-0" />
						<FolderOpen className="h-3.5 w-3.5 text-muted flex-shrink-0" />
					</>
				) : (
					<>
						<ChevronRight className="h-3 w-3 text-muted flex-shrink-0" />
						<Folder className="h-3.5 w-3.5 text-muted flex-shrink-0" />
					</>
				)}
				<span className="truncate">{node.name}</span>
			</button>
			{isExpanded && (
				<div>
					{Array.from(node.children.values()).map((child) => (
						<FileTreeNode
							key={child.path}
							node={child}
							depth={depth + 1}
							selectedFile={selectedFile}
							onSelectFile={onSelectFile}
							diffs={diffs}
						/>
					))}
				</div>
			)}
		</div>
	);
}
