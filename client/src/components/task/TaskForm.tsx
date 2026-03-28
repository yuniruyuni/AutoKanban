import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
import { KANBAN_COLUMNS, STATUS_CONFIG } from "@/lib/constants";
import type { TaskStatus } from "@/store";

interface TaskFormProps {
	initialValues?: {
		title: string;
		description?: string | null;
		status?: TaskStatus;
	};
	onSubmit: (data: {
		title: string;
		description?: string;
		status?: TaskStatus;
	}) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
	showStatus?: boolean;
}

export function TaskForm({
	initialValues,
	onSubmit,
	onCancel,
	isSubmitting,
	showStatus = false,
}: TaskFormProps) {
	const [title, setTitle] = useState(initialValues?.title || "");
	const [description, setDescription] = useState(
		initialValues?.description || "",
	);
	const [status, setStatus] = useState<TaskStatus>(
		initialValues?.status || "todo",
	);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!title.trim()) {
			setError("Task title is required");
			return;
		}

		try {
			await onSubmit({
				title: title.trim(),
				description: description.trim() || undefined,
				status: showStatus ? status : undefined,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		}
	};

	const statusOptions = KANBAN_COLUMNS.map((s) => ({
		value: s,
		label: STATUS_CONFIG[s].label,
	}));

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<Input
				label="Title"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="Task title"
				error={error && !title.trim() ? "Required" : undefined}
				autoFocus
			/>

			<Textarea
				label="Description (optional)"
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				placeholder="Add a description..."
				rows={3}
			/>

			{showStatus && (
				<Select
					label="Status"
					value={status}
					onChange={(e) => setStatus(e.target.value as TaskStatus)}
					options={statusOptions}
				/>
			)}

			{error && title.trim() && <p className="text-sm text-red-500">{error}</p>}

			<div className="flex justify-end gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Saving..." : initialValues ? "Save" : "Create Task"}
				</Button>
			</div>
		</form>
	);
}
