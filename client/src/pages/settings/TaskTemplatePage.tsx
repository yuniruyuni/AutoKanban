import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { ConfirmDialog } from "@/components/atoms/ConfirmDialog";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
} from "@/components/atoms/Dialog";
import { SidebarLayout } from "@/components/project/SidebarLayout";
import { trpc } from "@/trpc";

interface TaskTemplateFormData {
	title: string;
	description: string;
	condition: string;
	sortOrder: number;
}

const CONDITION_LABELS: Record<string, string> = {
	"": "常に適用",
	no_dev_server: "devServerScript 未設定時のみ",
};

export function TaskTemplatePage() {
	const utils = trpc.useUtils();
	const { data, isLoading } = trpc.taskTemplate.list.useQuery();
	const templates = data?.templates ?? [];

	const createMutation = trpc.taskTemplate.create.useMutation({
		onSuccess: () => utils.taskTemplate.list.invalidate(),
	});
	const updateMutation = trpc.taskTemplate.update.useMutation({
		onSuccess: () => utils.taskTemplate.list.invalidate(),
	});
	const deleteMutation = trpc.taskTemplate.delete.useMutation({
		onSuccess: () => utils.taskTemplate.list.invalidate(),
	});

	const [isAddOpen, setIsAddOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const editingTemplate = editingId
		? templates.find((t) => t.id === editingId)
		: null;

	const handleCreate = async (formData: TaskTemplateFormData) => {
		await createMutation.mutateAsync({
			title: formData.title,
			description: formData.description || null,
			condition: (formData.condition || null) as "no_dev_server" | null,
			sortOrder: formData.sortOrder,
		});
		setIsAddOpen(false);
	};

	const handleUpdate = async (formData: TaskTemplateFormData) => {
		if (!editingId) return;
		await updateMutation.mutateAsync({
			id: editingId,
			title: formData.title,
			description: formData.description || null,
			condition: (formData.condition || null) as "no_dev_server" | null,
			sortOrder: formData.sortOrder,
		});
		setEditingId(null);
	};

	const handleDelete = async () => {
		if (!deleteId) return;
		await deleteMutation.mutateAsync({ id: deleteId });
		setDeleteId(null);
	};

	return (
		<SidebarLayout>
			<div className="flex flex-col gap-8 py-8 px-10">
				{/* Header */}
				<div className="flex flex-col gap-1">
					<h1 className="text-[28px] font-bold text-primary-foreground">
						Task Templates
					</h1>
					<p className="text-sm text-secondary-foreground">
						新規プロジェクト作成時に自動登録されるデフォルトタスクを管理します
					</p>
				</div>

				{/* Templates Section */}
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<div className="flex flex-col gap-1">
							<h2 className="text-lg font-semibold text-primary-foreground">
								Default Tasks
							</h2>
							<p className="text-[13px] text-secondary-foreground">
								新規プロジェクト作成時にこれらのタスクが自動生成されます
							</p>
						</div>
						<Button onClick={() => setIsAddOpen(true)}>Add Template</Button>
					</div>

					{isLoading ? (
						<div className="text-center py-12 text-muted">Loading...</div>
					) : templates.length === 0 ? (
						<div className="border border-dashed rounded-lg p-12 text-center">
							<p className="text-muted">
								テンプレートが設定されていません
							</p>
							<p className="text-sm text-muted mt-1">
								テンプレートを追加すると、新規プロジェクト作成時にタスクが自動登録されます
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-2 rounded-lg border border-border bg-primary">
							{templates.map((tmpl) => (
								<div
									key={tmpl.id}
									className="flex items-center gap-4 py-4 px-5 border border-border rounded-none first:rounded-t-lg last:rounded-b-lg"
								>
									<div className="flex-1 min-w-0 flex flex-col gap-1">
										<div className="text-[15px] font-semibold text-primary-foreground">
											{tmpl.title}
										</div>
										{tmpl.description && (
											<div className="text-xs text-muted line-clamp-2">
												{tmpl.description}
											</div>
										)}
										<div className="text-xs text-secondary-foreground">
											{CONDITION_LABELS[tmpl.condition ?? ""] ??
												tmpl.condition}
										</div>
									</div>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => setEditingId(tmpl.id)}
											className="flex items-center justify-center h-8 w-8 text-muted hover:text-secondary-foreground hover:bg-hover rounded transition-colors"
											title="Edit"
										>
											<Pencil className="h-4 w-4" />
										</button>
										<button
											type="button"
											onClick={() => setDeleteId(tmpl.id)}
											disabled={deleteMutation.isPending}
											className="flex items-center justify-center h-8 w-8 text-muted hover:text-destructive hover:bg-red-50 rounded transition-colors disabled:opacity-50"
											title="Delete"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Add Dialog */}
			<Dialog
				open={isAddOpen}
				onClose={() => setIsAddOpen(false)}
				width={600}
			>
				<DialogHeader
					subtitle="新規プロジェクト作成時に自動登録されるタスクを追加"
					onClose={() => setIsAddOpen(false)}
				>
					Add Task Template
				</DialogHeader>
				<DialogContent>
					<TaskTemplateForm
						onSubmit={handleCreate}
						onCancel={() => setIsAddOpen(false)}
						isSubmitting={createMutation.isPending}
						nextSortOrder={templates.length}
					/>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog
				open={!!editingTemplate}
				onClose={() => setEditingId(null)}
				width={600}
			>
				<DialogHeader onClose={() => setEditingId(null)}>
					Edit Task Template
				</DialogHeader>
				<DialogContent>
					{editingTemplate && (
						<TaskTemplateForm
							initialValues={{
								title: editingTemplate.title,
								description: editingTemplate.description ?? "",
								condition: editingTemplate.condition ?? "",
								sortOrder: editingTemplate.sortOrder,
							}}
							onSubmit={handleUpdate}
							onCancel={() => setEditingId(null)}
							isSubmitting={updateMutation.isPending}
							nextSortOrder={templates.length}
						/>
					)}
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<Dialog
				open={!!deleteId}
				onClose={() => setDeleteId(null)}
				width={400}
			>
				<DialogHeader onClose={() => setDeleteId(null)}>
					Delete Template
				</DialogHeader>
				<DialogContent>
					<p className="text-sm text-secondary-foreground">
						このテンプレートを削除しますか？この操作は取り消せません。
					</p>
				</DialogContent>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setDeleteId(null)}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
					>
						{deleteMutation.isPending ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</Dialog>

			<ConfirmDialog />
		</SidebarLayout>
	);
}

function TaskTemplateForm({
	initialValues,
	onSubmit,
	onCancel,
	isSubmitting,
	nextSortOrder,
}: {
	initialValues?: TaskTemplateFormData;
	onSubmit: (data: TaskTemplateFormData) => Promise<void>;
	onCancel: () => void;
	isSubmitting: boolean;
	nextSortOrder: number;
}) {
	const [title, setTitle] = useState(initialValues?.title ?? "");
	const [description, setDescription] = useState(
		initialValues?.description ?? "",
	);
	const [condition, setCondition] = useState(
		initialValues?.condition ?? "",
	);
	const [sortOrder, setSortOrder] = useState(
		initialValues?.sortOrder ?? nextSortOrder,
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;
		onSubmit({ title, description, condition, sortOrder });
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="tmpl-title"
					className="text-sm font-medium text-primary-foreground"
				>
					Title
				</label>
				<input
					id="tmpl-title"
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="タスクのタイトル"
					className="px-3 py-2 rounded-md border border-border bg-primary text-sm text-primary-foreground outline-none focus:ring-1 focus:ring-accent"
					required
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="tmpl-desc"
					className="text-sm font-medium text-primary-foreground"
				>
					Description
				</label>
				<textarea
					id="tmpl-desc"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="タスクの説明（任意）"
					rows={3}
					className="px-3 py-2 rounded-md border border-border bg-primary text-sm text-primary-foreground outline-none focus:ring-1 focus:ring-accent resize-y"
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="tmpl-condition"
					className="text-sm font-medium text-primary-foreground"
				>
					Condition
				</label>
				<select
					id="tmpl-condition"
					value={condition}
					onChange={(e) => setCondition(e.target.value)}
					className="px-3 py-2 rounded-md border border-border bg-primary text-sm text-primary-foreground outline-none focus:ring-1 focus:ring-accent"
				>
					<option value="">常に適用</option>
					<option value="no_dev_server">
						devServerScript 未設定時のみ
					</option>
				</select>
				<p className="text-xs text-muted">
					テンプレートが適用される条件を選択します
				</p>
			</div>

			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="tmpl-sort"
					className="text-sm font-medium text-primary-foreground"
				>
					Sort Order
				</label>
				<input
					id="tmpl-sort"
					type="number"
					value={sortOrder}
					onChange={(e) => setSortOrder(Number(e.target.value))}
					className="px-3 py-2 rounded-md border border-border bg-primary text-sm text-primary-foreground outline-none focus:ring-1 focus:ring-accent w-24"
				/>
			</div>

			<div className="flex justify-end gap-3 pt-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting || !title.trim()}>
					{isSubmitting ? "Saving..." : "Save"}
				</Button>
			</div>
		</form>
	);
}
