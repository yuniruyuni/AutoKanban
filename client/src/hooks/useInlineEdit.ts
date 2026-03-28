import { useCallback, useEffect, useRef, useState } from "react";

interface UseInlineEditOptions {
	value: string;
	onSave: (value: string) => void;
	multiline?: boolean;
}

export function useInlineEdit({ value, onSave, multiline }: UseInlineEditOptions) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

	useEffect(() => {
		setDraft(value);
	}, [value]);

	useEffect(() => {
		if (isEditing && ref.current) {
			ref.current.focus();
			// Move cursor to end
			const len = ref.current.value.length;
			ref.current.setSelectionRange(len, len);
		}
	}, [isEditing]);

	const startEditing = useCallback(() => {
		setDraft(value);
		setIsEditing(true);
	}, [value]);

	const save = useCallback(() => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== value) {
			onSave(trimmed);
		}
		setIsEditing(false);
	}, [draft, value, onSave]);

	const cancel = useCallback(() => {
		setDraft(value);
		setIsEditing(false);
	}, [value]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				cancel();
			} else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				save();
			}
		},
		[cancel, save, multiline],
	);

	return {
		isEditing,
		draft,
		setDraft,
		ref,
		startEditing,
		save,
		cancel,
		handleKeyDown,
	};
}
