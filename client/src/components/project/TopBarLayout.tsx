import { ArrowLeft, GitBranch, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useSnapshot } from "valtio";
import { getIconComponent } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { toolStore } from "@/store";
import { trpc } from "@/trpc";

interface TopBarLayoutProps {
	children: ReactNode;
	title: string;
	backLabel?: string;
	onBack?: () => void;
	repoPath?: string;
	branch?: string;
	projectId?: string;
	className?: string;
}

export function TopBarLayout({
	children,
	title,
	backLabel = "Projects",
	onBack,
	repoPath,
	branch,
	projectId,
	className,
}: TopBarLayoutProps) {
	const { tools } = useSnapshot(toolStore);
	const executeTool = trpc.tool.execute.useMutation();

	const handleToolClick = async (toolId: string) => {
		if (!projectId) return;
		try {
			await executeTool.mutateAsync({ toolId, projectId });
		} catch (error) {
			console.error("Failed to execute tool:", error);
		}
	};

	return (
		<div className="flex flex-col h-screen bg-primary">
			{/* Top Bar */}
			<header className="flex items-center gap-4 bg-secondary border-b border-border px-6 py-4">
				{/* Back Button */}
				{onBack && (
					<button
						type="button"
						onClick={onBack}
						className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-secondary-foreground rounded-md hover:bg-hover transition-colors"
					>
						<ArrowLeft className="h-[18px] w-[18px]" />
						<span>{backLabel}</span>
					</button>
				)}

				{/* Page Title + Repo Section */}
				<div className="flex items-center gap-3 flex-1 min-w-0">
					<h1 className="text-xl font-semibold text-primary-foreground">
						{title}
					</h1>
					{repoPath && (
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2 px-3 py-1.5 bg-hover rounded-md">
								<GitBranch className="h-3.5 w-3.5 text-muted" />
								<span className="font-mono text-xs text-secondary-foreground">
									{repoPath}
								</span>
								{branch && (
									<span className="rounded px-1.5 py-0.5 bg-accent text-[11px] font-medium text-white">
										{branch}
									</span>
								)}
							</div>
							{tools.length > 0 && (
								<div className="flex items-center gap-1">
									{tools.map((tool) => {
										const IconComponent = getIconComponent(tool.icon);
										return (
											<button
												type="button"
												key={tool.id}
												className="flex items-center justify-center h-7 w-7 rounded bg-hover text-secondary-foreground hover:text-primary-foreground transition-colors"
												onClick={() => handleToolClick(tool.id)}
												title={tool.name}
											>
												{IconComponent && (
													<IconComponent
														className="h-3.5 w-3.5"
														style={{ color: tool.iconColor }}
													/>
												)}
											</button>
										);
									})}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Top Actions */}
				<div className="flex items-center gap-3">
					<button
						type="button"
						className="flex items-center justify-center h-9 w-9 bg-hover rounded-md text-secondary-foreground hover:text-primary-foreground transition-colors"
					>
						<Search className="h-[18px] w-[18px]" />
					</button>
				</div>
			</header>

			{/* Main Content */}
			<main className={cn("flex-1 overflow-hidden", className)}>
				{children}
			</main>
		</div>
	);
}
