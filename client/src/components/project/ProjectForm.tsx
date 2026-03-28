import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Textarea } from "@/components/atoms/Textarea";

interface ProjectFormProps {
	initialValues?: {
		name: string;
		description?: string | null;
		devScript?: string | null;
	};
	onSubmit: (data: {
		name: string;
		description?: string;
		devScript?: string;
	}) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export function ProjectForm({
	initialValues,
	onSubmit,
	onCancel,
	isSubmitting,
}: ProjectFormProps) {
	const [name, setName] = useState(initialValues?.name || "");
	const [description, setDescription] = useState(
		initialValues?.description || "",
	);
	const [devScript, setDevScript] = useState(initialValues?.devScript || "");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!name.trim()) {
			setError("Project name is required");
			return;
		}

		try {
			await onSubmit({
				name: name.trim(),
				description: description.trim() || undefined,
				devScript: devScript.trim() || undefined,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<Input
				label="Project Name"
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder="My Project"
				error={error && !name.trim() ? "Required" : undefined}
				autoFocus
			/>

			<Textarea
				label="Description (optional)"
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				placeholder="Project description..."
				rows={3}
			/>

			<Textarea
				label="Dev Script (optional)"
				value={devScript}
				onChange={(e) => setDevScript(e.target.value)}
				placeholder="npm run dev"
				rows={2}
			/>

			{error && name.trim() && <p className="text-sm text-red-500">{error}</p>}

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
					{isSubmitting
						? "Saving..."
						: initialValues
							? "Save"
							: "Create Project"}
				</Button>
			</div>
		</form>
	);
}
