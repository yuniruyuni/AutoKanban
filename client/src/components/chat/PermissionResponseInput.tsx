import {
	Check,
	CheckCheck,
	Loader2,
	ShieldCheck,
	Terminal,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePermissionResponse } from "@/hooks/usePermissionResponse";
import { cn } from "@/lib/utils";

interface PendingPermission {
	requestId: string;
	toolName: string;
	toolInput: Record<string, unknown>;
}

interface PermissionResponseInputProps {
	sessionId: string;
	permissions: PendingPermission[];
}

/**
 * PermissionResponseInput - Replaces chat input when permission approval is pending.
 *
 * Per Pencil design (2qpzP, timer removed):
 * - Header: ShieldCheck + "Permission required" + pending count badge
 * - Tool details: tool icon + tool name + command (no timer)
 * - Buttons: Deny (N) / Approve (Y) / Approve All
 */
export function PermissionResponseInput({
	sessionId,
	permissions,
}: PermissionResponseInputProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const { approve, deny, isLoading } = usePermissionResponse(sessionId);

	const current = permissions[currentIndex];
	const pendingCount = permissions.length;

	// Reset index if permissions change
	useEffect(() => {
		if (currentIndex >= permissions.length) {
			setCurrentIndex(Math.max(0, permissions.length - 1));
		}
	}, [permissions.length, currentIndex]);

	const handleApprove = useCallback(async () => {
		if (!current) return;
		await approve(current.requestId);
		// Move to next pending
		if (currentIndex < permissions.length - 1) {
			setCurrentIndex(currentIndex + 1);
		}
	}, [current, approve, currentIndex, permissions.length]);

	const handleDeny = useCallback(async () => {
		if (!current) return;
		await deny(current.requestId);
		if (currentIndex < permissions.length - 1) {
			setCurrentIndex(currentIndex + 1);
		}
	}, [current, deny, currentIndex, permissions.length]);

	const handleApproveAll = useCallback(async () => {
		for (const perm of permissions) {
			await approve(perm.requestId);
		}
	}, [permissions, approve]);

	// Keyboard shortcuts
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (isLoading) return;
			if (
				e.target instanceof HTMLTextAreaElement ||
				e.target instanceof HTMLInputElement
			)
				return;

			if (e.key === "y") {
				e.preventDefault();
				handleApprove();
			} else if (e.key === "n") {
				e.preventDefault();
				handleDeny();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isLoading, handleApprove, handleDeny]);

	if (!current) return null;

	const commandText =
		(current.toolInput.command as string | undefined) ??
		(current.toolInput.description as string | undefined) ??
		JSON.stringify(current.toolInput).substring(0, 80);

	return (
		<div className="border-t border-border bg-secondary">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border">
				<div className="flex items-center gap-2">
					<ShieldCheck className="h-4 w-4 text-accent" />
					<span className="text-[13px] font-semibold text-primary-foreground">
						Permission required
					</span>
				</div>
				{pendingCount > 1 && (
					<span className="flex items-center justify-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
						{pendingCount} pending
					</span>
				)}
			</div>

			{/* Tool details */}
			<div className="px-4 py-3">
				<div className="flex items-center gap-2">
					<Terminal className="h-3.5 w-3.5 text-secondary-foreground" />
					<span className="text-[13px] font-medium text-secondary-foreground">
						{current.toolName}:
					</span>
					<span className="text-[13px] font-mono text-primary-foreground truncate">
						{commandText}
					</span>
				</div>
			</div>

			{/* Action buttons */}
			<div className="flex items-center justify-between px-4 pb-3">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleDeny}
						disabled={isLoading}
						className={cn(
							"flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
							"border border-destructive text-destructive hover:bg-destructive/10",
							"disabled:cursor-not-allowed disabled:opacity-50",
						)}
					>
						{isLoading ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<X className="h-3.5 w-3.5" />
						)}
						Deny (N)
					</button>
					<button
						type="button"
						onClick={handleApprove}
						disabled={isLoading}
						className={cn(
							"flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
							"bg-success text-white hover:opacity-90",
							"disabled:cursor-not-allowed disabled:opacity-50",
						)}
					>
						{isLoading ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Check className="h-3.5 w-3.5" />
						)}
						Approve (Y)
					</button>
				</div>

				{pendingCount > 1 && (
					<button
						type="button"
						onClick={handleApproveAll}
						disabled={isLoading}
						className={cn(
							"flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
							"border border-success text-success hover:bg-success/10",
							"disabled:cursor-not-allowed disabled:opacity-50",
						)}
					>
						<CheckCheck className="h-3.5 w-3.5" />
						Approve All
					</button>
				)}
			</div>
		</div>
	);
}
