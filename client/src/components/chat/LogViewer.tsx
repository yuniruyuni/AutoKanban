import { useEffect, useRef } from "react";
import type { LogEntry } from "../../hooks/useLogStream";
import { ansiToSpans } from "../../lib/ansi-to-spans";
import { cn } from "../../lib/utils";

interface LogViewerProps {
	logs: LogEntry[];
	isStreaming: boolean;
	className?: string;
}

export function LogViewer({ logs, isStreaming, className }: LogViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const shouldAutoScroll = useRef(true);

	// Auto-scroll to bottom when new logs arrive
	useEffect(() => {
		if (shouldAutoScroll.current && containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight;
		}
	}, []);

	// Detect if user has scrolled up
	const handleScroll = () => {
		if (!containerRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
		shouldAutoScroll.current = scrollTop + clientHeight >= scrollHeight - 50;
	};

	return (
		<div
			ref={containerRef}
			onScroll={handleScroll}
			className={cn(
				"bg-gray-900 text-gray-100 font-mono text-sm rounded-lg p-4 overflow-y-auto",
				className,
			)}
		>
			{logs.length === 0 ? (
				<div className="text-muted italic">
					{isStreaming ? "Waiting for logs..." : "No logs yet"}
				</div>
			) : (
				<div className="space-y-1">
					{logs.map((entry, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
						<LogLine key={index} entry={entry} />
					))}
					{isStreaming && (
						<div className="text-green-400 animate-pulse">Streaming...</div>
					)}
				</div>
			)}
		</div>
	);
}

function LogLine({ entry }: { entry: LogEntry }) {
	const timestamp = new Date(entry.timestamp).toLocaleTimeString();
	const sourceColor = entry.source === "stderr" ? "text-red-400" : "text-muted";

	return (
		<div className="flex gap-2">
			<span className="text-secondary-foreground shrink-0">[{timestamp}]</span>
			<span className={cn("shrink-0", sourceColor)}>[{entry.source}]</span>
			<span className="whitespace-pre-wrap break-all">
				<AnsiText text={entry.data} />
			</span>
		</div>
	);
}

function AnsiText({ text }: { text: string }) {
	const spans = ansiToSpans(text);

	if (spans.length === 0) return null;

	// If single span with no style, render plain text
	if (spans.length === 1 && Object.keys(spans[0].style).length === 0) {
		return <>{spans[0].text}</>;
	}

	return (
		<>
			{spans.map((span, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: ANSI spans have no stable unique identifier
				<span key={i} style={span.style}>
					{span.text}
				</span>
			))}
		</>
	);
}
