import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface AttemptSummary {
	workspaceId: string;
	attempt: number;
	branch: string;
	archived: boolean;
	sessionId: string | null;
	latestStatus: string | null;
	createdAt: string;
}

interface AttemptSwitcherProps {
	attempts: AttemptSummary[];
	activeAttempt: number | null;
	selectedAttempt: number;
	onSelectAttempt: (attempt: AttemptSummary) => void;
}

const statusColors: Record<string, string> = {
	running: "bg-success/10 text-success",
	completed: "bg-success/10 text-success",
	failed: "bg-destructive/10 text-destructive",
	killed: "bg-warning/10 text-warning",
	awaiting_approval: "bg-warning/10 text-warning",
};

export function AttemptSwitcher({
	attempts,
	activeAttempt,
	selectedAttempt,
	onSelectAttempt,
}: AttemptSwitcherProps) {
	const [isOpen, setIsOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	// Close dropdown on outside click
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	if (attempts.length < 2) return null;

	// Sort newest first for dropdown display
	const sortedAttempts = [...attempts].sort(
		(a, b) => b.attempt - a.attempt,
	);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:opacity-80"
			>
				Attempt {selectedAttempt}
				<ChevronDown className="h-3 w-3" />
			</button>

			{isOpen && (
				<div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-primary shadow-lg">
					{sortedAttempts.map((attempt) => (
						<button
							type="button"
							key={attempt.workspaceId}
							onClick={() => {
								onSelectAttempt(attempt);
								setIsOpen(false);
							}}
							className={cn(
								"flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-secondary transition-colors",
								attempt.attempt === selectedAttempt && "bg-secondary",
							)}
						>
							<span className="font-medium text-primary-foreground">
								Attempt {attempt.attempt}
							</span>
							{attempt.attempt === activeAttempt && (
								<span className="text-[10px] text-muted">(current)</span>
							)}
							{attempt.latestStatus && (
								<span
									className={cn(
										"rounded px-1.5 py-0.5 text-[10px]",
										statusColors[attempt.latestStatus] ?? "bg-secondary text-muted",
									)}
								>
									{attempt.latestStatus}
								</span>
							)}
							<span className="ml-auto text-[10px] text-muted">
								{new Date(attempt.createdAt).toLocaleDateString()}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
