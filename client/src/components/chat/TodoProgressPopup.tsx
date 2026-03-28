import { CheckCircle2, Circle, CircleDot, ListChecks } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TodoProgressState } from "@/hooks/useTodoProgress";

function StatusIcon({ status }: { status: string }) {
	switch (status) {
		case "completed":
			return <CheckCircle2 className="h-4 w-4 text-success" />;
		case "in_progress":
			return <CircleDot className="h-4 w-4 text-accent" />;
		default:
			return <Circle className="h-4 w-4 text-muted" />;
	}
}

export function TodoProgressPopup({
	todos,
	completed,
	total,
	percentage,
}: TodoProgressState) {
	const [open, setOpen] = useState(false);
	const popoverRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node) &&
				buttonRef.current &&
				!buttonRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	const isEmpty = todos.length === 0;

	// Empty state: disabled icon
	if (isEmpty) {
		return (
			<button
				type="button"
				disabled
				className="flex items-center justify-center text-muted opacity-40 cursor-not-allowed"
				aria-label="Tasks"
			>
				<ListChecks className="h-5 w-5" />
			</button>
		);
	}

	return (
		<div className="relative">
			<button
				type="button"
				ref={buttonRef}
				onClick={() => setOpen(!open)}
				className="flex items-center justify-center text-secondary-foreground hover:text-primary-foreground transition-colors"
				aria-label="Tasks"
			>
				<div className="relative">
					<ListChecks className="h-5 w-5" />
					{/* Progress indicator dot */}
					<span
						className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${
							percentage === 100 ? "bg-success" : "bg-accent"
						}`}
					/>
				</div>
			</button>

			{/* Popover */}
			{open && (
				<div
					ref={popoverRef}
					className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-border bg-secondary shadow-lg"
				>
					<div className="flex flex-col gap-3 p-4">
						{/* Header */}
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-primary-foreground">
								Tasks
							</span>
							<span className="text-xs text-muted">
								{completed}/{total} completed
							</span>
						</div>

						{/* Progress bar */}
						<div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
							<div
								className={`h-full rounded-full transition-all duration-300 ${
									percentage === 100 ? "bg-success" : "bg-accent"
								}`}
								style={{ width: `${percentage}%` }}
							/>
						</div>

						{/* Todo list */}
						<ul className="max-h-60 space-y-1 overflow-y-auto">
							{todos.map((todo, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
								<li key={i} className="flex items-start gap-2 py-0.5">
									<span className="mt-0.5 flex shrink-0 items-center justify-center">
										<StatusIcon status={todo.status} />
									</span>
									<span className="text-sm leading-5 text-secondary-foreground break-words">
										{todo.content}
									</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
}
