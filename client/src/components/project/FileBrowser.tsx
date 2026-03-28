import {
	ChevronRight,
	File,
	FileCode,
	FileJson,
	FileText,
	Folder,
	GitBranch,
	Home,
	Image,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import {
	type DirectoryEntry,
	useDirectoryBrowser,
} from "@/hooks/useDirectoryBrowser";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { cn } from "@/lib/utils";

interface FileBrowserProps {
	onSelect: (entry: DirectoryEntry) => void;
	selectedPath: string | null;
}

function getFileIcon(filename: string) {
	const ext = filename.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "ts":
		case "tsx":
		case "js":
		case "jsx":
		case "py":
		case "rb":
		case "go":
		case "rs":
		case "c":
		case "cpp":
		case "h":
		case "java":
		case "kt":
		case "swift":
		case "cs":
		case "php":
		case "vue":
		case "svelte":
			return FileCode;
		case "json":
		case "yaml":
		case "yml":
		case "toml":
		case "xml":
			return FileJson;
		case "md":
		case "txt":
		case "rst":
		case "log":
			return FileText;
		case "png":
		case "jpg":
		case "jpeg":
		case "gif":
		case "svg":
		case "webp":
		case "ico":
			return Image;
		default:
			return File;
	}
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBrowser({ onSelect, selectedPath }: FileBrowserProps) {
	const {
		containerRef,
		value: leftPanelRatio,
		handleMouseDown,
	} = useResizablePanel({
		mode: "ratio",
		initial: 0.4,
		min: 0.25,
		max: 0.6,
	});

	// Left pane: directories only (navigation)
	const leftBrowser = useDirectoryBrowser(undefined, false);

	// Right pane: selected directory contents (files + directories)
	const [rightPanePath, setRightPanePath] = useState<string | null>(null);
	const rightBrowser = useDirectoryBrowser(rightPanePath ?? undefined, true);

	// Parse path into parts for breadcrumb
	const pathParts = leftBrowser.currentPath.split("/").filter(Boolean);

	// Get selected directory name for right pane header
	const selectedDirName = rightPanePath
		? (rightPanePath.split("/").filter(Boolean).pop() ?? "Directory")
		: null;

	return (
		<div className="flex flex-col gap-4 flex-1 min-h-0">
			{/* Path bar */}
			<div className="flex items-center gap-2 bg-secondary rounded-md px-3.5 py-2.5">
				<button
					type="button"
					onClick={() => {
						leftBrowser.navigateToHome();
						setRightPanePath(null);
					}}
					className="text-muted hover:text-primary-foreground transition-colors"
				>
					<Home className="w-4 h-4" />
				</button>
				{pathParts.map((part, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
					<div key={index} className="flex items-center gap-2">
						<span className="text-sm text-muted">/</span>
						<button
							type="button"
							onClick={() => {
								const newPath = `/${pathParts.slice(0, index + 1).join("/")}`;
								leftBrowser.navigateTo(newPath);
								setRightPanePath(newPath);
							}}
							className={cn(
								"text-sm hover:underline",
								index === pathParts.length - 1
									? "text-primary-foreground font-medium"
									: "text-secondary-foreground",
							)}
						>
							{part}
						</button>
					</div>
				))}
			</div>

			{/* Split pane container */}
			<div ref={containerRef} className="flex flex-1 min-h-0">
				{/* Left pane - Directory tree */}
				<div
					className="flex flex-col min-w-0 min-h-0 bg-secondary border border-border rounded-l-lg overflow-hidden"
					style={{ width: `${leftPanelRatio * 100}%` }}
				>
					{/* Left pane header */}
					<div className="flex items-center justify-between px-4 py-3 border-b border-border">
						<span className="text-[13px] font-semibold text-secondary-foreground">
							Select Repository or Directory
						</span>
						<button
							type="button"
							onClick={() => leftBrowser.navigateTo(leftBrowser.currentPath)}
							className="flex items-center gap-1.5 hover:bg-hover transition-colors rounded-sm px-1.5 py-1"
						>
							<RefreshCw className="w-3.5 h-3.5 text-muted" />
							<span className="text-xs text-muted">Refresh</span>
						</button>
					</div>

					{/* Left pane list */}
					<div className="flex-1 overflow-y-auto py-2">
						{/* Go up button */}
						{leftBrowser.canNavigateUp && (
							<button
								type="button"
								onClick={() => {
									if (leftBrowser.parentPath) {
										setRightPanePath(leftBrowser.parentPath);
									}
									leftBrowser.navigateUp();
								}}
								className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-hover transition-colors"
							>
								<ChevronRight className="w-4 h-4 text-muted rotate-180" />
								<Folder className="w-[18px] h-[18px] text-warning" />
								<span className="text-sm text-secondary-foreground">..</span>
							</button>
						)}

						{leftBrowser.isLoading && (
							<div className="px-4 py-2.5 text-sm text-muted">
								Loading...
							</div>
						)}

						{leftBrowser.entries.map((entry) => (
							<LeftPaneItem
								key={entry.path}
								entry={entry}
								isSelected={selectedPath === entry.path}
								isRightPaneTarget={rightPanePath === entry.path}
								onSelect={(e) => {
									onSelect(e);
									// Also set this directory as right pane target
									setRightPanePath(e.path);
								}}
								onNavigate={leftBrowser.navigateTo}
							/>
						))}

						{!leftBrowser.isLoading && leftBrowser.entries.length === 0 && (
							<div className="px-4 py-2.5 text-sm text-muted">
								No directories found
							</div>
						)}
					</div>
				</div>

				{/* Resize divider */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle uses mouse drag, not click interaction */}
				<div
					data-testid="resize-divider"
					className="w-2 bg-secondary flex items-center justify-center cursor-col-resize flex-shrink-0 transition-colors hover:bg-hover"
					onMouseDown={handleMouseDown}
				>
					<div className="w-0.5 h-6 bg-border rounded-full" />
				</div>

				{/* Right pane - Contents preview */}
				<div
					className="flex flex-col min-w-0 min-h-0 bg-secondary border border-border rounded-r-lg overflow-hidden"
					style={{ width: `${(1 - leftPanelRatio) * 100}%` }}
				>
					{/* Right pane header */}
					<div className="flex items-center justify-between px-4 py-3 border-b border-border">
						<span className="text-[13px] font-semibold text-secondary-foreground">
							{selectedDirName
								? `Contents of ${selectedDirName}`
								: "Select a directory to preview"}
						</span>
						{rightPanePath && (
							<button
								type="button"
								onClick={() => rightBrowser.navigateTo(rightPanePath)}
								className="flex items-center gap-1.5 hover:bg-hover transition-colors rounded-sm px-1.5 py-1"
							>
								<RefreshCw className="w-3.5 h-3.5 text-muted" />
								<span className="text-xs text-muted">Refresh</span>
							</button>
						)}
					</div>

					{/* Right pane content */}
					<div className="flex-1 overflow-y-auto py-2">
						{!rightPanePath && (
							<div className="flex items-center justify-center h-full text-sm text-muted">
								Select a directory from the left pane to preview its contents
							</div>
						)}

						{rightPanePath && rightBrowser.isLoading && (
							<div className="px-4 py-2.5 text-sm text-muted">
								Loading...
							</div>
						)}

						{rightPanePath &&
							!rightBrowser.isLoading &&
							rightBrowser.entries.map((entry) => (
								<RightPaneItem
									key={entry.path}
									entry={entry}
									onDirectoryClick={
										entry.isDirectory
											? () => {
													// Navigate left pane to show this directory
													leftBrowser.navigateTo(rightPanePath);
													// Select the directory
													onSelect(entry);
													// Update right pane to show this directory's contents
													setRightPanePath(entry.path);
												}
											: undefined
									}
								/>
							))}

						{rightPanePath &&
							!rightBrowser.isLoading &&
							rightBrowser.entries.length === 0 && (
								<div className="px-4 py-2.5 text-sm text-muted">
									Directory is empty
								</div>
							)}
					</div>
				</div>
			</div>
		</div>
	);
}

interface LeftPaneItemProps {
	entry: DirectoryEntry;
	isSelected: boolean;
	isRightPaneTarget: boolean;
	onSelect: (entry: DirectoryEntry) => void;
	onNavigate: (path: string) => void;
}

function LeftPaneItem({
	entry,
	isSelected,
	isRightPaneTarget,
	onSelect,
	onNavigate,
}: LeftPaneItemProps) {
	const handleClick = () => {
		onSelect(entry);
	};

	const handleNavigate = (e: React.MouseEvent) => {
		e.stopPropagation();
		onNavigate(entry.path);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: complex layout div with multiple children
		<div
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") handleClick();
			}}
			className={cn(
				"flex items-center gap-3 w-full px-4 py-2.5 transition-colors cursor-pointer",
				isSelected
					? "bg-accent text-white rounded-md"
					: isRightPaneTarget
						? "bg-hover"
						: "hover:bg-hover",
			)}
		>
			{/* Navigate button - only for non-git directories */}
			{!entry.isGitRepo ? (
				<button
					type="button"
					onClick={handleNavigate}
					className={cn(
						"w-5 h-5 flex items-center justify-center rounded hover:bg-black/10",
						isSelected && "hover:bg-white/20",
					)}
					title="Open directory"
				>
					<ChevronRight
						className={cn(
							"w-4 h-4",
							isSelected ? "text-white/70" : "text-muted",
						)}
					/>
				</button>
			) : (
				<div className="w-5 h-5 flex items-center justify-center">
					<ChevronRight
						className={cn(
							"w-4 h-4",
							isSelected ? "text-white/50" : "text-muted",
						)}
					/>
				</div>
			)}

			{entry.isGitRepo ? (
				<GitBranch
					className={cn(
						"w-[18px] h-[18px]",
						isSelected ? "text-white" : "text-accent",
					)}
				/>
			) : (
				<Folder className="w-[18px] h-[18px] text-warning" />
			)}

			<span
				className={cn(
					"text-sm flex-1 truncate",
					isSelected
						? "font-medium text-white"
						: entry.isGitRepo
							? "text-primary-foreground"
							: "text-secondary-foreground",
				)}
			>
				{entry.name}
			</span>

			{entry.isGitRepo && (
				<span
					className={cn(
						"px-2 py-0.5 rounded-sm text-[11px] font-medium",
						isSelected ? "bg-white/20 text-white" : "bg-hover text-muted",
					)}
				>
					git
				</span>
			)}
		</div>
	);
}

interface RightPaneItemProps {
	entry: DirectoryEntry;
	onDirectoryClick?: () => void;
}

function RightPaneItem({ entry, onDirectoryClick }: RightPaneItemProps) {
	const FileIcon = entry.isDirectory ? Folder : getFileIcon(entry.name);
	const iconColor = entry.isDirectory
		? "text-warning"
		: entry.isGitRepo
			? "text-accent"
			: "text-muted";

	const isClickable = entry.isDirectory && onDirectoryClick;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: role and handlers are conditionally applied based on isClickable
		<div
			role={isClickable ? "button" : undefined}
			tabIndex={isClickable ? 0 : undefined}
			className={cn(
				"flex items-center gap-3 w-full px-4 py-2 transition-colors",
				isClickable ? "cursor-pointer hover:bg-hover" : "hover:bg-hover",
			)}
			onClick={isClickable ? onDirectoryClick : undefined}
			onKeyDown={
				isClickable
					? (e) => {
							if (e.key === "Enter" || e.key === " ") onDirectoryClick?.();
						}
					: undefined
			}
		>
			<FileIcon className={cn("w-4 h-4", iconColor)} />
			<span className="text-[13px] text-primary-foreground flex-1 truncate">
				{entry.name}
			</span>
			{!entry.isDirectory && entry.size !== undefined && (
				<span className="text-xs text-muted font-mono">
					{formatFileSize(entry.size)}
				</span>
			)}
			{entry.isDirectory && entry.isGitRepo && (
				<span className="px-2 py-0.5 rounded-sm text-[11px] font-medium bg-hover text-muted">
					git
				</span>
			)}
		</div>
	);
}
