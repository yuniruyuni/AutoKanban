import { Circle, GitBranch, Pencil, Trash2 } from "lucide-react";
import { useSnapshot } from "valtio";
import { getIconComponent } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { type ProjectWithStats, toolStore } from "@/store";
import { trpc } from "@/trpc";

interface ProjectCardProps {
	project: ProjectWithStats;
	isFocused?: boolean;
	onSelect: () => void;
	onDelete: () => void;
	onEdit?: () => void;
}

export function ProjectCard({
	project,
	isFocused,
	onSelect,
	onDelete,
	onEdit,
}: ProjectCardProps) {
	const stats = project.taskStats;
	const { tools } = useSnapshot(toolStore);
	const executeTool = trpc.tool.execute.useMutation();

	const handleToolClick = async (toolId: string) => {
		try {
			await executeTool.mutateAsync({ toolId, projectId: project.id });
		} catch (error) {
			console.error("Failed to execute tool:", error);
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: complex layout div with multiple children
		<div
			role="button"
			tabIndex={0}
			data-project-id={project.id}
			className={cn(
				"flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-all hover:shadow-md",
				isFocused && "ring-2 ring-accent",
			)}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") onSelect();
			}}
		>
			{/* Project name */}
			<span className="text-base font-semibold text-primary-foreground">
				{project.name}
			</span>

			{/* Description */}
			<p className="text-[13px] font-normal text-secondary-foreground w-full">
				{project.description || "No description"}
			</p>

			{/* Repo info */}
			<div className="flex w-full items-center gap-2.5 rounded-sm bg-secondary px-3 py-2.5">
				<GitBranch className="h-4 w-4 shrink-0 text-accent" />
				<span className="min-w-0 flex-1 truncate font-mono text-xs text-secondary-foreground">
					{project.repoPath ||
						`~/projects/${project.name.toLowerCase().replace(/\s+/g, "-")}`}
				</span>
				<div className="flex items-center gap-1">
					<Circle className="h-3 w-3 text-muted" />
					<span className="font-mono text-[11px] text-muted">
						{project.branch || "main"}
					</span>
				</div>
			</div>

			{/* Task stats */}
			<div className="flex w-full items-center gap-4">
				<div className="flex items-center gap-1.5">
					<div className="h-2 w-2 rounded-sm bg-muted" />
					<span className="text-xs text-muted">{stats.todo} Todo</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="h-2 w-2 rounded-sm bg-info" />
					<span className="text-xs text-muted">
						{stats.inProgress} In Progress
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="h-2 w-2 rounded-sm bg-success" />
					<span className="text-xs text-muted">{stats.done} Done</span>
				</div>
			</div>

			{/* Tools row */}
			<div className="flex w-full items-center justify-end gap-2">
				{tools.length > 0 && (
					<>
						<span className="text-xs text-muted">Open in:</span>
						{tools.map((tool) => {
							const IconComponent = getIconComponent(tool.icon);
							return (
								<button
									type="button"
									key={tool.id}
									className="flex items-center gap-1.5 rounded-sm border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-hover"
									onClick={(e) => {
										e.stopPropagation();
										handleToolClick(tool.id);
									}}
									title={tool.name}
								>
									{IconComponent && (
										<IconComponent
											className="h-3.5 w-3.5"
											style={{ color: tool.iconColor }}
										/>
									)}
									{tool.name}
								</button>
							);
						})}
					</>
				)}
				<div className="ml-auto flex items-center gap-1">
					{onEdit && (
						<button
							type="button"
							className="flex items-center justify-center h-7 w-7 rounded-sm text-muted hover:text-primary-foreground hover:bg-hover"
							onClick={(e) => {
								e.stopPropagation();
								onEdit();
							}}
							title="Edit project"
						>
							<Pencil className="h-3.5 w-3.5" />
						</button>
					)}
					<button
						type="button"
						className="flex items-center justify-center h-7 w-7 rounded-sm text-muted hover:text-destructive hover:bg-red-50"
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						title="Delete project"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
}
