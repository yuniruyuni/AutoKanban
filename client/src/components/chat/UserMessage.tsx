import { Check, Pencil, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TextContent } from "./types";

interface UserMessageProps {
	content: TextContent;
	messageUuid?: string;
	onEdit?: (messageUuid: string, newText: string) => void;
}

export function UserMessage({
	content,
	messageUuid,
	onEdit,
}: UserMessageProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editText, setEditText] = useState(content.text);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (isEditing && textareaRef.current) {
			textareaRef.current.focus();
			textareaRef.current.setSelectionRange(editText.length, editText.length);
		}
	}, [isEditing, editText.length]);

	const handleSubmitEdit = () => {
		if (messageUuid && onEdit && editText.trim() && editText !== content.text) {
			onEdit(messageUuid, editText.trim());
		}
		setIsEditing(false);
	};

	const handleCancelEdit = () => {
		setEditText(content.text);
		setIsEditing(false);
	};

	const canEdit = !!messageUuid && !!onEdit;

	return (
		<div className="group flex justify-end">
			<div className="flex max-w-[80%] gap-3">
				{isEditing ? (
					<div className="flex-1 rounded-lg border border-info bg-info/10 p-2">
						<textarea
							ref={textareaRef}
							value={editText}
							onChange={(e) => setEditText(e.target.value)}
							className="w-full resize-none rounded bg-primary p-2 text-sm text-primary focus:outline-none"
							rows={Math.min(editText.split("\n").length + 1, 10)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									handleSubmitEdit();
								} else if (e.key === "Escape") {
									handleCancelEdit();
								}
							}}
						/>
						<div className="mt-1 flex justify-end gap-1">
							<button
								type="button"
								onClick={handleCancelEdit}
								className="rounded p-1 text-muted hover:bg-hover"
							>
								<X className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onClick={handleSubmitEdit}
								className="rounded bg-info p-1 text-white hover:opacity-90"
							>
								<Check className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				) : (
					<div className="relative rounded-lg bg-info/10 px-4 py-3">
						<p className="whitespace-pre-wrap text-sm text-primary-foreground">
							{content.text}
						</p>
						{canEdit && (
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="absolute -left-8 top-1/2 -translate-y-1/2 rounded p-1 text-muted opacity-0 transition-opacity hover:bg-hover hover:text-secondary-foreground group-hover:opacity-100"
							>
								<Pencil className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				)}
				<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-info">
					<User className="h-4 w-4 text-white" />
				</div>
			</div>
		</div>
	);
}
