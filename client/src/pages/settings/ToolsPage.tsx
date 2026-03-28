import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { ConfirmDialog } from "@/components/atoms/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader } from "@/components/atoms/Dialog";
import { SidebarLayout } from "@/components/project/SidebarLayout";
import { ToolForm } from "@/components/settings/ToolForm";
import { useToolMutations, useTools } from "@/hooks/useTools";
import { getIconComponent } from "@/lib/icons";
import type { Tool } from "@/store";
import { uiActions } from "@/store";

export function ToolsPage() {
	const { tools, isLoading } = useTools();
	const {
		createTool,
		updateTool,
		deleteTool,
		isCreating,
		isUpdating,
		isDeleting,
	} = useToolMutations();

	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [editingTool, setEditingTool] = useState<Tool | null>(null);

	const handleCreateTool = async (data: {
		name: string;
		icon: string;
		iconColor: string;
		command: string;
	}) => {
		await createTool({
			name: data.name,
			icon: data.icon,
			iconColor: data.iconColor,
			command: data.command,
			sortOrder: tools.length,
		});
		setIsAddDialogOpen(false);
	};

	const handleUpdateTool = async (data: {
		name: string;
		icon: string;
		iconColor: string;
		command: string;
	}) => {
		if (!editingTool) return;
		await updateTool({
			toolId: editingTool.id,
			...data,
		});
		setEditingTool(null);
	};

	const handleDeleteTool = (toolId: string) => {
		uiActions.openConfirmDialog(
			"Are you sure you want to delete this tool?",
			() => {
				deleteTool(toolId);
			},
		);
	};

	return (
		<SidebarLayout>
			<div className="flex flex-col gap-8 py-8 px-10">
				{/* Header */}
				<div className="flex flex-col gap-1">
					<h1 className="text-[28px] font-bold text-primary-foreground">Tools</h1>
					<p className="text-sm text-secondary-foreground">
						Configure external tools and integrations
					</p>
				</div>

				{/* Tools Section */}
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<div className="flex flex-col gap-1">
							<h2 className="text-lg font-semibold text-primary-foreground">
								External Tools
							</h2>
							<p className="text-[13px] text-secondary-foreground">
								Configure tools to open project directories
							</p>
						</div>
						<Button onClick={() => setIsAddDialogOpen(true)}>Add Tool</Button>
					</div>

					{isLoading ? (
						<div className="text-center py-12 text-muted">Loading...</div>
					) : tools.length === 0 ? (
						/* Empty State */
						<div className="border border-dashed rounded-lg p-12 text-center">
							<p className="text-muted">No tools configured yet</p>
							<p className="text-sm text-muted mt-1">
								Add tools to extend Auto Kanban&apos;s capabilities
							</p>
						</div>
					) : (
						/* Tools List */
						<div className="flex flex-col gap-2 rounded-lg border border-border bg-primary">
							{tools.map((tool) => (
								<ToolRow
									key={tool.id}
									tool={tool}
									onEdit={() => setEditingTool(tool)}
									onDelete={() => handleDeleteTool(tool.id)}
									isDeleting={isDeleting}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Add Tool Dialog */}
			<Dialog
				open={isAddDialogOpen}
				onClose={() => setIsAddDialogOpen(false)}
				width={600}
			>
				<DialogHeader
					subtitle="Configure a new tool to open project directories"
					onClose={() => setIsAddDialogOpen(false)}
				>
					Add External Tool
				</DialogHeader>
				<DialogContent>
					<ToolForm
						onSubmit={handleCreateTool}
						onCancel={() => setIsAddDialogOpen(false)}
						isSubmitting={isCreating}
					/>
				</DialogContent>
			</Dialog>

			{/* Edit Tool Dialog */}
			<Dialog
				open={!!editingTool}
				onClose={() => setEditingTool(null)}
				width={600}
			>
				<DialogHeader onClose={() => setEditingTool(null)}>
					Edit Tool
				</DialogHeader>
				<DialogContent>
					{editingTool && (
						<ToolForm
							initialValues={{
								name: editingTool.name,
								icon: editingTool.icon,
								iconColor: editingTool.iconColor,
								command: editingTool.command,
							}}
							onSubmit={handleUpdateTool}
							onCancel={() => setEditingTool(null)}
							isSubmitting={isUpdating}
						/>
					)}
				</DialogContent>
			</Dialog>
			<ConfirmDialog />
		</SidebarLayout>
	);
}

interface ToolRowProps {
	tool: Tool;
	onEdit: () => void;
	onDelete: () => void;
	isDeleting: boolean;
}

function ToolRow({ tool, onEdit, onDelete, isDeleting }: ToolRowProps) {
	const IconComponent = getIconComponent(tool.icon);

	return (
		<div className="flex items-center gap-4 py-4 px-5 border border-border rounded-none first:rounded-t-lg last:rounded-b-lg">
			<div
				className="flex h-10 w-10 items-center justify-center rounded-md shrink-0"
				style={{ backgroundColor: tool.iconColor }}
			>
				{IconComponent && <IconComponent className="h-5 w-5 text-white" />}
			</div>
			<div className="flex-1 min-w-0 flex flex-col gap-1">
				<div className="text-[15px] font-semibold text-primary-foreground">
					{tool.name}
				</div>
				<div className="text-xs text-muted font-mono">{tool.command}</div>
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onEdit}
					className="flex items-center justify-center h-8 w-8 text-muted hover:text-secondary-foreground hover:bg-hover rounded transition-colors"
					title="Edit"
				>
					<Pencil className="h-4 w-4" />
				</button>
				<button
					type="button"
					onClick={onDelete}
					disabled={isDeleting}
					className="flex items-center justify-center h-8 w-8 text-muted hover:text-destructive hover:bg-red-50 rounded transition-colors disabled:opacity-50"
					title="Delete"
				>
					<Trash2 className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
