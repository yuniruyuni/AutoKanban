import { Send, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFollowUp } from "@/hooks/useFollowUp";
import { useVariants } from "@/hooks/useVariants";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc";

interface FollowUpInputProps {
	sessionId: string | null;
	className?: string;
	onExecutionStarted?: (executionProcessId: string) => void;
}

/**
 * Input component for sending follow-up messages to a session.
 *
 * The server handles all the logic:
 * - If the agent is idle or not running, the message is sent immediately
 * - If the agent is busy, the message is queued for later
 *
 * The client just:
 * - Sends messages
 * - Shows the queued message (if any)
 * - Allows canceling the queued message
 */
export function FollowUpInput({
	sessionId,
	className,
	onExecutionStarted,
}: FollowUpInputProps) {
	const [prompt, setPrompt] = useState("");
	const { variants, isLoading: variantsLoading } = useVariants("claude-code");
	const [variant, setVariant] = useState("");
	const [images, setImages] = useState<Array<{ file: File; preview: string }>>(
		[],
	);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const draftLoadedRef = useRef(false);
	const {
		send,
		cancel,
		queuedMessage,
		hasQueuedMessage,
		isSending,
		isCancelling,
	} = useFollowUp(sessionId);

	// Set default variant when variants load
	useEffect(() => {
		if (variants.length > 0 && !variant) {
			setVariant(variants[0].name);
		}
	}, [variants, variant]);

	// Draft auto-save
	const saveDraftMutation = trpc.execution.saveDraft.useMutation();
	const draftQuery = trpc.execution.getDraft.useQuery(
		{ sessionId: sessionId ?? "" },
		{ enabled: !!sessionId, staleTime: Infinity },
	);

	// Load saved draft on mount
	useEffect(() => {
		if (draftQuery.data && !draftLoadedRef.current && draftQuery.data.text) {
			setPrompt(draftQuery.data.text);
			draftLoadedRef.current = true;
		}
	}, [draftQuery.data]);

	// Reset draft loaded flag when session changes
	useEffect(() => {
		draftLoadedRef.current = false;
	}, []);

	// Debounced draft save (300ms)
	const saveDraft = useCallback(
		(text: string) => {
			if (!sessionId) return;
			if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
			draftTimerRef.current = setTimeout(() => {
				saveDraftMutation.mutate({ sessionId, text });
			}, 300);
		},
		[sessionId, saveDraftMutation],
	);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
		};
	}, []);

	const handlePromptChange = (text: string) => {
		setPrompt(text);
		saveDraft(text);
	};

	// Auto-resize textarea based on content
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
		}
	}, []);

	// Handle image paste from clipboard
	const handlePaste = useCallback((e: React.ClipboardEvent) => {
		const items = e.clipboardData.items;
		const newImages: Array<{ file: File; preview: string }> = [];

		for (const item of items) {
			if (item.type.startsWith("image/")) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) {
					newImages.push({ file, preview: URL.createObjectURL(file) });
				}
			}
		}

		if (newImages.length > 0) {
			setImages((prev) => [...prev, ...newImages]);
		}
	}, []);

	const removeImage = useCallback((index: number) => {
		setImages((prev) => {
			const removed = prev[index];
			if (removed) URL.revokeObjectURL(removed.preview);
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	// Cleanup image previews on unmount
	useEffect(() => {
		return () => {
			for (const img of images) URL.revokeObjectURL(img.preview);
		};
	}, [images]);

	const handleSend = async () => {
		if (!prompt.trim() || !sessionId) return;

		try {
			const result = await send(prompt.trim(), { variant });
			setPrompt("");
			setImages((prev) => {
				for (const img of prev) URL.revokeObjectURL(img.preview);
				return [];
			});
			// Clear draft after send
			saveDraftMutation.mutate({ sessionId, text: "" });
			if (result.executionProcessId) {
				onExecutionStarted?.(result.executionProcessId);
			}
		} catch (error) {
			console.error("Failed to send message:", error);
		}
	};

	const handleCancelQueue = async () => {
		try {
			await cancel();
		} catch (error) {
			console.error("Failed to cancel queue:", error);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Cmd/Ctrl + Enter to send
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			handleSend();
		}
	};

	const isDisabled = isSending || !sessionId;

	return (
		<div className={cn("", className)}>
			{/* Queued message indicator */}
			{hasQueuedMessage && queuedMessage && (
				<div className="flex items-center gap-4 border-t border-border bg-card px-6 py-3">
					<Timer className="h-4 w-4 text-accent flex-shrink-0" />
					<span className="text-[13px] font-semibold text-accent">Queued:</span>
					<span className="text-[13px] text-secondary-foreground truncate flex-1">
						{queuedMessage.prompt}
					</span>
					<button
						type="button"
						onClick={handleCancelQueue}
						disabled={isCancelling}
						className="flex h-6 w-6 items-center justify-center rounded-full bg-hover hover:opacity-80"
						title="Cancel queued message"
					>
						<X className="h-3.5 w-3.5 text-muted" />
					</button>
				</div>
			)}

			{/* Chat box wrapper */}
			<div className="border-t border-border bg-secondary p-4 space-y-2">
				{/* Image previews */}
				{images.length > 0 && (
					<div className="flex gap-2 flex-wrap">
						{images.map((img, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
							<div key={i} className="relative group">
								<img
									src={img.preview}
									alt={`Attachment ${i + 1}`}
									className="h-16 w-16 rounded-md object-cover border border-border"
								/>
								<button
									type="button"
									onClick={() => removeImage(i)}
									className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary-foreground text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						))}
					</div>
				)}

				{/* Chat box container */}
				<div className="rounded-md border border-border bg-primary">
					<textarea
						ref={textareaRef}
						value={prompt}
						onChange={(e) => handlePromptChange(e.target.value)}
						onKeyDown={handleKeyDown}
						onPaste={handlePaste}
						placeholder="Type your next instruction..."
						disabled={isDisabled}
						rows={1}
						className="w-full resize-none border-0 bg-transparent px-[18px] py-3.5 text-sm placeholder:text-muted focus:outline-none focus:ring-0 disabled:opacity-50 min-h-[44px] max-h-[200px] overflow-y-auto rounded-t-md"
					/>
					<div className="flex items-center justify-between border-t border-border px-3 py-2">
						<select
							value={variant}
							onChange={(e) => setVariant(e.target.value)}
							disabled={isDisabled || variantsLoading || variants.length === 0}
							className="text-xs bg-transparent border-0 text-secondary-foreground px-1 py-1 rounded-sm focus:outline-none focus:ring-0 disabled:opacity-50"
						>
							{variantsLoading ? (
								<option value="">Loading...</option>
							) : variants.length === 0 ? (
								<option value="">No variants</option>
							) : (
								variants.map((v) => (
									<option key={v.id} value={v.name}>
										{v.name}
									</option>
								))
							)}
						</select>
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted">⌘+Enter</span>
							<button
								type="button"
								onClick={handleSend}
								disabled={!prompt.trim() || isDisabled}
								className="flex h-8 w-8 items-center justify-center rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
							>
								<Send className="h-3.5 w-3.5 text-white" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
