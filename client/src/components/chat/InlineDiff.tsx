import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import { useMemo, useState } from "react";
import "@git-diff-view/react/styles/diff-view.css";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineDiffProps {
	path: string;
	oldString?: string;
	newString?: string;
}

function buildHunks(oldStr: string, newStr: string): string[] {
	const oldLines = oldStr.split("\n");
	const newLines = newStr.split("\n");
	const header = `@@ -1,${oldLines.length} +1,${newLines.length} @@`;
	const body = [
		...oldLines.map((l) => `-${l}`),
		...newLines.map((l) => `+${l}`),
	];
	return [`${header}\n${body.join("\n")}`];
}

function countChanges(
	oldStr?: string,
	newStr?: string,
): { added: number; removed: number } {
	const added = newStr ? newStr.split("\n").length : 0;
	const removed = oldStr ? oldStr.split("\n").length : 0;
	return { added, removed };
}

function getLang(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	const langMap: Record<string, string> = {
		ts: "typescript",
		tsx: "tsx",
		js: "javascript",
		jsx: "jsx",
		py: "python",
		rs: "rust",
		go: "go",
		rb: "ruby",
		java: "java",
		css: "css",
		html: "xml",
		json: "json",
		md: "markdown",
		sql: "sql",
		sh: "bash",
		yml: "yaml",
		yaml: "yaml",
	};
	return langMap[ext] ?? "plaintext";
}

export function InlineDiff({ path, oldString, newString }: InlineDiffProps) {
	const [expanded, setExpanded] = useState(false);
	const { added, removed } = useMemo(
		() => countChanges(oldString, newString),
		[oldString, newString],
	);

	const lang = getLang(path);
	const hunks = useMemo(
		() => buildHunks(oldString ?? "", newString ?? ""),
		[oldString, newString],
	);

	const isShortChange = added + removed < 3;

	// For very short changes, show inline red/green blocks
	if (isShortChange && !expanded) {
		return (
			<div className="space-y-2 bg-secondary p-3">
				<div className="flex items-center justify-between">
					<span className="font-mono text-sm text-secondary-foreground">{path}</span>
					<div className="flex items-center gap-2 text-xs">
						{removed > 0 && (
							<span className="flex items-center text-red-600">
								<Minus className="h-3 w-3" />
								{removed}
							</span>
						)}
						{added > 0 && (
							<span className="flex items-center text-green-600">
								<Plus className="h-3 w-3" />
								{added}
							</span>
						)}
					</div>
				</div>
				{oldString && (
					<div className="rounded bg-destructive/10 p-2">
						<pre className="overflow-auto whitespace-pre-wrap font-mono text-xs text-destructive">
							{oldString}
						</pre>
					</div>
				)}
				{newString && (
					<div className="rounded bg-success/10 p-2">
						<pre className="overflow-auto whitespace-pre-wrap font-mono text-xs text-success">
							{newString}
						</pre>
					</div>
				)}
				{(oldString || newString) && added + removed >= 3 && (
					<button
						type="button"
						onClick={() => setExpanded(true)}
						className="text-xs text-accent hover:text-accent"
					>
						Show diff view
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="bg-secondary">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-2 px-3 py-2"
			>
				<ChevronRight
					className={cn(
						"h-3 w-3 text-muted transition-transform",
						expanded && "rotate-90",
					)}
				/>
				<span className="font-mono text-sm text-secondary-foreground">{path}</span>
				<div className="ml-auto flex items-center gap-2 text-xs">
					{removed > 0 && (
						<span className="flex items-center text-red-600">
							<Minus className="h-3 w-3" />
							{removed}
						</span>
					)}
					{added > 0 && (
						<span className="flex items-center text-green-600">
							<Plus className="h-3 w-3" />
							{added}
						</span>
					)}
				</div>
			</button>
			{expanded && (
				<div className="border-t border text-xs">
					<DiffView
						data={{
							oldFile: {
								fileName: path,
								fileLang: lang,
								content: oldString ?? "",
							},
							newFile: {
								fileName: path,
								fileLang: lang,
								content: newString ?? "",
							},
							hunks,
						}}
						diffViewFontSize={12}
						diffViewHighlight={false}
						diffViewMode={DiffModeEnum.Unified}
					/>
				</div>
			)}
		</div>
	);
}
