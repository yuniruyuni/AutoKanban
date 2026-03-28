import {
	ChevronDown,
	ChevronRight,
	Columns2,
	FileCode,
	FileEdit,
	FilePlus,
	Folder,
	FolderOpen,
	List,
	MoveRight,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { type GitDiff, useDiffs, useFileDiff } from "@/hooks/useGit";
import { cn } from "@/lib/utils";

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

// -- File Tree --

interface TreeNode {
	name: string;
	path: string;
	children: Map<string, TreeNode>;
	isFile: boolean;
}

function buildFileTree(diffs: GitDiff[]): TreeNode {
	const root: TreeNode = {
		name: "",
		path: "",
		children: new Map(),
		isFile: false,
	};

	for (const diff of diffs) {
		const parts = diff.filePath.split("/");
		let current = root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isFile = i === parts.length - 1;
			const path = parts.slice(0, i + 1).join("/");

			if (!current.children.has(part)) {
				current.children.set(part, {
					name: part,
					path,
					children: new Map(),
					isFile,
				});
			}
			current = current.children.get(part) ?? current;
		}
	}

	return root;
}

interface FileTreeViewProps {
	tree: TreeNode;
	selectedFile: string | null;
	onSelectFile: (path: string) => void;
	diffs: GitDiff[];
}

function FileTreeView({
	tree,
	selectedFile,
	onSelectFile,
	diffs,
}: FileTreeViewProps) {
	return (
		<div>
			{Array.from(tree.children.values()).map((node) => (
				<FileTreeNode
					key={node.path}
					node={node}
					depth={0}
					selectedFile={selectedFile}
					onSelectFile={onSelectFile}
					diffs={diffs}
				/>
			))}
		</div>
	);
}

interface FileTreeNodeProps {
	node: TreeNode;
	depth: number;
	selectedFile: string | null;
	onSelectFile: (path: string) => void;
	diffs: GitDiff[];
}

function FileTreeNode({
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

function FileStatusIcon({ status }: { status?: string }) {
	switch (status) {
		case "added":
			return <FilePlus className="h-3.5 w-3.5 flex-shrink-0 text-[#22C55E]" />;
		case "deleted":
			return <Trash2 className="h-3.5 w-3.5 flex-shrink-0 text-[#EF4444]" />;
		case "modified":
			return <FileEdit className="h-3.5 w-3.5 flex-shrink-0 text-[#F59E0B]" />;
		case "renamed":
			return <MoveRight className="h-3.5 w-3.5 flex-shrink-0 text-[#E87B35]" />;
		default:
			return <FileCode className="h-3.5 w-3.5 flex-shrink-0 text-[#E87B35]" />;
	}
}

// -- Diff Viewer --

interface DiffViewerProps {
	workspaceId: string;
	projectId: string;
	filePath: string;
	diff?: GitDiff;
	viewMode: "unified" | "side-by-side";
	onViewModeChange: (mode: "unified" | "side-by-side") => void;
}

function DiffViewer({
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
						<div className={cn(
							"h-3.5 w-3.5 rounded-[3px] border border-[#E4E4E7]",
							hideWhitespace ? "bg-[#E87B35]" : "bg-white",
						)} />
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

interface FileDiffContentProps {
	workspaceId: string;
	projectId: string;
	filePath: string;
	viewMode: "unified" | "side-by-side";
	hideWhitespace: boolean;
}

function FileDiffContent({
	workspaceId,
	projectId,
	filePath,
	viewMode,
	hideWhitespace,
}: FileDiffContentProps) {
	const { diff, isLoading } = useFileDiff(workspaceId, projectId, filePath);

	if (isLoading) {
		return (
			<div className="flex h-32 items-center justify-center text-muted text-xs">
				Loading diff...
			</div>
		);
	}

	if (!diff) {
		return (
			<div className="flex h-32 items-center justify-center text-muted text-xs">
				No diff available
			</div>
		);
	}

	if (viewMode === "side-by-side") {
		return <SideBySideDiff rawDiff={diff} hideWhitespace={hideWhitespace} />;
	}

	return <UnifiedDiff rawDiff={diff} hideWhitespace={hideWhitespace} />;
}

// -- Whitespace helpers --

function isWhitespaceOnlyChange(line: string): boolean {
	// A line starting with + or - where the content (after the prefix) is only whitespace changes
	const content = line.substring(1);
	return content.trim().length === 0 || content === "";
}

function filterWhitespaceHunks(rawDiff: string): string {
	const lines = rawDiff.split("\n");
	const result: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Pass through metadata lines
		if (
			line.startsWith("diff ") ||
			line.startsWith("index ") ||
			line.startsWith("---") ||
			line.startsWith("+++")
		) {
			result.push(line);
			i++;
			continue;
		}

		// For hunk headers, collect the entire hunk and check if all changes are whitespace-only
		if (line.startsWith("@@")) {
			const hunkLines: string[] = [line];
			i++;

			while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("diff ")) {
				hunkLines.push(lines[i]);
				i++;
			}

			// Check if all +/- lines in this hunk are whitespace-only
			const changedLines = hunkLines.filter((l) => l.startsWith("+") || l.startsWith("-"));
			const allWhitespace = changedLines.length > 0 && changedLines.every(isWhitespaceOnlyChange);

			if (!allWhitespace) {
				// Keep this hunk, but filter out individual whitespace-only change pairs
				for (const hl of hunkLines) {
					result.push(hl);
				}
			}
			continue;
		}

		result.push(line);
		i++;
	}

	return result.join("\n");
}

// -- Unified Diff View (GitHub-style light theme) --

function UnifiedDiff({ rawDiff, hideWhitespace }: { rawDiff: string; hideWhitespace: boolean }) {
	const filtered = hideWhitespace ? filterWhitespaceHunks(rawDiff) : rawDiff;
	const lines = filtered.split("\n");
	let oldLineNum = 0;
	let newLineNum = 0;

	// Filter out metadata lines
	const contentLines = lines.filter((line) => {
		if (
			line.startsWith("diff ") ||
			line.startsWith("index ") ||
			line.startsWith("---") ||
			line.startsWith("+++")
		) {
			return false;
		}
		return true;
	});

	return (
		<div className="font-mono text-xs">
			{contentLines.map((line, index) => {
				// Handle hunk headers
				if (line.startsWith("@@")) {
					const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
					if (match) {
						oldLineNum = parseInt(match[1], 10) - 1;
						newLineNum = parseInt(match[2], 10) - 1;
					}
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
							key={index}
							className="flex bg-[#F0F3F8] px-5 py-2 text-[#57606A]"
						>
							<span className="w-8 flex-shrink-0 text-right pr-4 select-none" />
							<span className="w-8 flex-shrink-0 text-right pr-4 select-none" />
							<span>{line}</span>
						</div>
					);
				}

				const isAddition = line.startsWith("+");
				const isDeletion = line.startsWith("-");

				if (isAddition) {
					newLineNum++;
				} else if (isDeletion) {
					oldLineNum++;
				} else {
					oldLineNum++;
					newLineNum++;
				}

				const bgColor = isAddition
					? "bg-[#DAFBE1]"
					: isDeletion
						? "bg-[#FFE2DD]"
						: "";

				const textColor = isAddition
					? "text-[#116329]"
					: isDeletion
						? "text-[#CF222E]"
						: "text-[#24292F]";

				const lineNumColor = "text-[#8C959F]";

				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
					<div key={index} className={cn("flex gap-4 px-5 py-0.5", bgColor)}>
						<span
							className={cn(
								"w-8 flex-shrink-0 text-right select-none",
								lineNumColor,
							)}
						>
							{isDeletion ? oldLineNum : isAddition ? "" : oldLineNum}
						</span>
						<span
							className={cn(
								"w-8 flex-shrink-0 text-right select-none",
								lineNumColor,
							)}
						>
							{isAddition ? newLineNum : isDeletion ? "" : newLineNum}
						</span>
						<span className={cn("break-all min-w-0", textColor)}>{line}</span>
					</div>
				);
			})}
		</div>
	);
}

// -- Side-by-Side Diff View --

interface DiffLine {
	type: "context" | "addition" | "deletion" | "hunk";
	content: string;
	oldLineNum?: number;
	newLineNum?: number;
}

function parseDiffLines(rawDiff: string): DiffLine[] {
	const lines = rawDiff.split("\n");
	const result: DiffLine[] = [];
	let oldLineNum = 0;
	let newLineNum = 0;

	for (const line of lines) {
		if (
			line.startsWith("diff ") ||
			line.startsWith("index ") ||
			line.startsWith("---") ||
			line.startsWith("+++")
		) {
			continue;
		}

		if (line.startsWith("@@")) {
			const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
			if (match) {
				oldLineNum = parseInt(match[1], 10) - 1;
				newLineNum = parseInt(match[2], 10) - 1;
			}
			result.push({ type: "hunk", content: line });
			continue;
		}

		if (line.startsWith("+")) {
			newLineNum++;
			result.push({ type: "addition", content: line, newLineNum });
		} else if (line.startsWith("-")) {
			oldLineNum++;
			result.push({ type: "deletion", content: line, oldLineNum });
		} else {
			oldLineNum++;
			newLineNum++;
			result.push({ type: "context", content: line, oldLineNum, newLineNum });
		}
	}

	return result;
}

interface SideBySidePair {
	left: DiffLine | null;
	right: DiffLine | null;
}

function pairSideBySide(lines: DiffLine[]): SideBySidePair[] {
	const pairs: SideBySidePair[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.type === "hunk") {
			pairs.push({ left: line, right: line });
			i++;
			continue;
		}

		if (line.type === "context") {
			pairs.push({ left: line, right: line });
			i++;
			continue;
		}

		// Collect consecutive deletions and additions
		const deletions: DiffLine[] = [];
		const additions: DiffLine[] = [];

		while (i < lines.length && lines[i].type === "deletion") {
			deletions.push(lines[i]);
			i++;
		}
		while (i < lines.length && lines[i].type === "addition") {
			additions.push(lines[i]);
			i++;
		}

		const maxLen = Math.max(deletions.length, additions.length);
		for (let j = 0; j < maxLen; j++) {
			pairs.push({
				left: j < deletions.length ? deletions[j] : null,
				right: j < additions.length ? additions[j] : null,
			});
		}
	}

	return pairs;
}

function SideBySideDiff({ rawDiff, hideWhitespace }: { rawDiff: string; hideWhitespace: boolean }) {
	const filtered = hideWhitespace ? filterWhitespaceHunks(rawDiff) : rawDiff;
	const lines = parseDiffLines(filtered);
	const pairs = pairSideBySide(lines);

	return (
		<div className="font-mono text-xs">
			{pairs.map((pair, index) => {
				if (pair.left?.type === "hunk") {
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
						<div key={index} className="flex">
							<div className="flex w-1/2 min-w-0 bg-[#F0F3F8] px-5 py-2 text-[#57606A] border-r border-[#E4E4E7]">
								<span className="w-8 flex-shrink-0" />
								<span className="break-all">{pair.left.content}</span>
							</div>
							<div className="flex w-1/2 min-w-0 bg-[#F0F3F8] px-5 py-2 text-[#57606A]">
								<span className="w-8 flex-shrink-0" />
								<span className="break-all">{pair.right?.content}</span>
							</div>
						</div>
					);
				}

				const leftBg = !pair.left
					? "bg-[#F5F5F5]"
					: pair.left.type === "deletion"
						? "bg-[#FFE2DD]"
						: "";
				const rightBg = !pair.right
					? "bg-[#F5F5F5]"
					: pair.right.type === "addition"
						? "bg-[#DAFBE1]"
						: "";
				const leftTextColor =
					pair.left?.type === "deletion" ? "text-[#CF222E]" : "text-[#24292F]";
				const rightTextColor =
					pair.right?.type === "addition" ? "text-[#116329]" : "text-[#24292F]";

				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
					<div key={index} className="flex">
						{/* Left (old) */}
						<div
							className={cn(
								"flex w-1/2 min-w-0 gap-4 px-5 py-0.5 border-r border-[#E4E4E7]",
								leftBg,
							)}
						>
							<span className="w-8 flex-shrink-0 text-right text-[#8C959F] select-none">
								{pair.left?.oldLineNum ?? ""}
							</span>
							<span className={cn("break-all", leftTextColor)}>{pair.left?.content ?? ""}</span>
						</div>
						{/* Right (new) */}
						<div className={cn("flex w-1/2 min-w-0 gap-4 px-5 py-0.5", rightBg)}>
							<span className="w-8 flex-shrink-0 text-right text-[#8C959F] select-none">
								{pair.right?.newLineNum ?? ""}
							</span>
							<span className={cn("break-all", rightTextColor)}>
								{pair.right?.content ?? ""}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}
