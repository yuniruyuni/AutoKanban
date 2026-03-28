import { ArrowLeft, Code, GitBranch, Search, Terminal } from "lucide-react";
import type { ReactNode } from "react";

interface LayoutProps {
	children: ReactNode;
	title?: string;
	onBack?: () => void;
	/** Project-level layout with repo info in top bar */
	projectView?: boolean;
	repoPath?: string;
	branch?: string;
}

export function Layout({
	children,
	title,
	onBack,
	projectView,
	repoPath,
	branch,
}: LayoutProps) {
	if (projectView) {
		return (
			<div className="flex h-screen flex-col bg-primary">
				{/* Top Bar */}
				<header className="flex items-center justify-between gap-4 border-b border-border bg-secondary px-6 py-4">
					<div className="flex items-center gap-3">
						{onBack && (
							<button
								type="button"
								onClick={onBack}
								className="flex items-center gap-2 rounded-md px-3 py-2 text-secondary-foreground hover:bg-hover"
							>
								<ArrowLeft className="h-[18px] w-[18px]" />
								<span className="text-sm font-medium">Projects</span>
							</button>
						)}
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<h1 className="text-xl font-semibold text-primary-foreground">
								{title || "Auto Kanban"}
							</h1>
							{repoPath && (
								<div className="flex items-center gap-4">
									<div className="flex items-center gap-2 rounded-md bg-hover px-3 py-1.5">
										<GitBranch className="h-3.5 w-3.5 text-muted" />
										<span className="font-mono text-xs text-secondary-foreground">
											{repoPath}
										</span>
										{branch && (
											<span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-medium text-white">
												{branch}
											</span>
										)}
									</div>
									<div className="flex items-center gap-1">
										<button
											type="button"
											className="flex h-7 w-7 items-center justify-center rounded bg-hover text-secondary-foreground hover:text-primary-foreground"
										>
											<Code className="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											className="flex h-7 w-7 items-center justify-center rounded bg-hover text-secondary-foreground hover:text-primary-foreground"
										>
											<Terminal className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
					<div className="flex items-center gap-3">
						<button
							type="button"
							className="flex h-9 w-9 items-center justify-center rounded-md bg-hover text-secondary-foreground hover:text-primary-foreground"
						>
							<Search className="h-[18px] w-[18px]" />
						</button>
					</div>
				</header>
				{/* Main Content */}
				<main className="flex-1 overflow-hidden">{children}</main>
			</div>
		);
	}

	// Default simple layout (for projects list, etc.)
	return (
		<div className="min-h-screen bg-secondary">
			<header className="border-b border-border bg-primary shadow-sm">
				<div className="mx-auto max-w-7xl px-4 py-4">
					<div className="flex items-center gap-4">
						{onBack && (
							<button
								type="button"
								onClick={onBack}
								className="flex h-8 w-8 items-center justify-center rounded-md text-secondary-foreground hover:bg-hover"
							>
								<ArrowLeft className="h-4 w-4" />
							</button>
						)}
						<h1 className="text-xl font-bold text-primary-foreground">
							{title || "Auto Kanban"}
						</h1>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
		</div>
	);
}
