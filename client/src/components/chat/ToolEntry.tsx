import {
	Bot,
	CheckCircle,
	ChevronRight,
	ClipboardList,
	Clock,
	FilePenLine,
	FileText,
	Globe,
	ListChecks,
	Loader2,
	Search,
	ShieldAlert,
	ShieldX,
	Terminal,
	Wrench,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { AnsiText } from "@/lib/ansi";
import { cn } from "@/lib/utils";
import { ApprovalCard } from "./ApprovalCard";
import { InlineDiff } from "./InlineDiff";
import { PlanCard } from "./PlanCard";
import { TodoCard } from "./TodoCard";
import type {
	ToolAction,
	ToolEntry as ToolEntryType,
	ToolResult,
} from "./types";

interface ToolEntryProps {
	entry: ToolEntryType;
	sessionId?: string | null;
	isProcessRunning?: boolean;
}

export function ToolEntryComponent({
	entry,
	sessionId: _sessionId,
	isProcessRunning = true,
}: ToolEntryProps) {
	const [expanded, setExpanded] = useState(false);

	// Special rendering for plan actions
	if (entry.action.type === "plan") {
		return <PlanCard entry={entry} />;
	}

	// Special rendering for todo management
	if (entry.action.type === "todo_management") {
		return <TodoCard entry={entry} />;
	}

	// If the process is no longer running, treat "running" tools as interrupted
	const effectiveStatus =
		entry.status === "running" && !isProcessRunning
			? "failed"
			: entry.status;

	const statusIcon = {
		running: <Loader2 className="h-4 w-4 animate-spin text-accent" />,
		success: <CheckCircle className="h-4 w-4 text-success" />,
		failed: <XCircle className="h-4 w-4 text-destructive" />,
		pending_approval: (
			<ShieldAlert className="h-4 w-4 animate-pulse text-accent" />
		),
		denied: <ShieldX className="h-4 w-4 text-destructive" />,
		timed_out: <Clock className="h-4 w-4 text-muted" />,
	}[effectiveStatus];

	const actionLabel = getActionLabel(entry.action);
	const actionIcon = getActionIcon(entry.action);

	return (
		<div className="ml-9 overflow-hidden rounded-md border border-border">
			{/* Header: Tool name + status */}
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-2 bg-secondary px-3 py-2 transition-colors hover:bg-hover"
			>
				{statusIcon}
				{actionIcon}
				<span className="text-sm font-medium text-secondary-foreground">
					{entry.toolName}
				</span>
				{actionLabel && (
					<span className="truncate text-sm text-muted">
						{actionLabel}
					</span>
				)}
				{entry.action.type === "command" &&
					entry.result?.exitCode !== undefined && (
						<ExitCodeBadge exitCode={entry.result.exitCode} />
					)}
				<ChevronRight
					className={cn(
						"ml-auto h-4 w-4 flex-shrink-0 text-muted transition-transform",
						expanded && "rotate-90",
					)}
				/>
			</button>

			{/* Details: Action info + result */}
			{expanded && (
				<div className="border-t border-border">
					<ActionDetail action={entry.action} />
					{entry.result && <ResultDetail result={entry.result} />}
				</div>
			)}

			{/* Approval card for pending permission (display only, no buttons) */}
			{entry.permissionRequestId &&
				(entry.status === "pending_approval" ||
					entry.status === "denied" ||
					entry.status === "timed_out") && (
					<div className="px-3 pb-2">
						<ApprovalCard toolName={entry.toolName} status={entry.status} />
					</div>
				)}
		</div>
	);
}

function getActionLabel(action: ToolAction): string {
	switch (action.type) {
		case "file_read":
		case "file_edit":
		case "file_write":
			return action.path;
		case "command":
			// Truncate long commands
			return action.command.length > 40
				? `${action.command.substring(0, 40)}...`
				: action.command;
		case "search":
			return action.pattern ?? action.query;
		case "web_fetch":
			return action.url;
		case "task":
			return action.subagentType ?? "task";
		case "plan":
			return "Plan";
		case "todo_management":
			return `${action.todos.length} items`;
		case "generic":
			return "";
	}
}

function getActionIcon(action: ToolAction): React.ReactNode {
	switch (action.type) {
		case "file_read":
			return <FileText className="h-4 w-4 text-muted" />;
		case "file_edit":
		case "file_write":
			return <FilePenLine className="h-4 w-4 text-muted" />;
		case "command":
			return <Terminal className="h-4 w-4 text-muted" />;
		case "search":
			return <Search className="h-4 w-4 text-muted" />;
		case "web_fetch":
			return <Globe className="h-4 w-4 text-muted" />;
		case "task":
			return <Bot className="h-4 w-4 text-muted" />;
		case "plan":
			return <ClipboardList className="h-4 w-4 text-accent" />;
		case "todo_management":
			return <ListChecks className="h-4 w-4 text-purple-500" />;
		case "generic":
			return <Wrench className="h-4 w-4 text-muted" />;
	}
}

function ActionDetail({ action }: { action: ToolAction }) {
	switch (action.type) {
		case "file_read":
			return (
				<div className="bg-secondary px-3 py-2 text-sm text-secondary-foreground">
					<span className="font-mono">{action.path}</span>
				</div>
			);
		case "file_edit":
			return (
				<InlineDiff
					path={action.path}
					oldString={action.oldString}
					newString={action.newString}
				/>
			);
		case "file_write":
			return (
				<div className="bg-secondary px-3 py-2 text-sm text-secondary-foreground">
					<span className="font-mono">{action.path}</span>
				</div>
			);
		case "command":
			return (
				<pre className="overflow-auto bg-secondary p-3 font-mono text-xs text-primary-foreground">
					{action.command}
				</pre>
			);
		case "search":
			return (
				<div className="bg-secondary px-3 py-2 text-sm">
					{action.pattern && (
						<div>
							<span className="text-muted">Pattern: </span>
							<span className="font-mono text-secondary-foreground">
								{action.pattern}
							</span>
						</div>
					)}
					{action.path && (
						<div>
							<span className="text-muted">Path: </span>
							<span className="font-mono text-secondary-foreground">
								{action.path}
							</span>
						</div>
					)}
				</div>
			);
		case "web_fetch":
			return (
				<div className="bg-secondary px-3 py-2 text-sm">
					<a
						href={action.url}
						target="_blank"
						rel="noopener noreferrer"
						className="font-mono text-accent hover:underline"
					>
						{action.url}
					</a>
				</div>
			);
		case "task":
			return (
				<div className="bg-secondary px-3 py-2">
					{action.subagentType && (
						<div className="mb-1 text-xs text-muted">
							Agent: {action.subagentType}
						</div>
					)}
					<p className="text-sm text-secondary-foreground">{action.description}</p>
				</div>
			);
		case "todo_management":
			return null;
		case "generic":
			return (
				<pre className="overflow-auto bg-secondary p-3 font-mono text-xs text-primary-foreground">
					{JSON.stringify(action.input, null, 2)}
				</pre>
			);
	}
}

function ExitCodeBadge({ exitCode }: { exitCode: number }) {
	const isSuccess = exitCode === 0;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs",
				isSuccess
					? "bg-success/10 text-success"
					: "bg-destructive/10 text-destructive",
			)}
		>
			<span
				className={cn(
					"inline-block h-1.5 w-1.5 rounded-full",
					isSuccess ? "bg-success" : "bg-destructive",
				)}
			/>
			{exitCode}
		</span>
	);
}

function ResultDetail({ result }: { result: ToolResult }) {
	const [expanded, setExpanded] = useState(false);
	const isLong = result.output.length > 300;
	const shouldCollapse = isLong && !expanded;

	return (
		<div className="border-t border-border">
			<div
				className={cn(
					"p-3",
					result.isError ? "bg-destructive/10" : "bg-secondary",
					shouldCollapse && "max-h-32 overflow-hidden",
				)}
			>
				<pre
					className={cn(
						"whitespace-pre-wrap font-mono text-xs",
						result.isError ? "text-destructive" : "text-primary-foreground",
					)}
				>
					{result.isError ? (
						result.output
					) : (
						<AnsiText
							text={result.output}
							defaultColor="var(--color-primary-foreground)"
						/>
					)}
				</pre>
			</div>
			{shouldCollapse && (
				<div
					className={cn(
						"px-3 pb-2",
						result.isError ? "bg-destructive/10" : "bg-secondary",
					)}
				>
					<button
						type="button"
						onClick={() => setExpanded(true)}
						className={cn(
							"text-xs",
							result.isError
								? "text-destructive hover:opacity-80"
								: "text-info hover:opacity-80",
						)}
					>
						Show more...
					</button>
				</div>
			)}
		</div>
	);
}
