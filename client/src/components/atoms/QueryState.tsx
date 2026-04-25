import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export type QueryStateError = { message?: string } | null | undefined;

interface QueryStateProps {
	isLoading: boolean;
	error?: QueryStateError;
	onRetry?: () => unknown;
	loadingFallback?: ReactNode;
	className?: string;
	children: ReactNode;
}

export function QueryState({
	isLoading,
	error,
	onRetry,
	loadingFallback,
	className,
	children,
}: QueryStateProps) {
	if (error) {
		return <QueryError error={error} onRetry={onRetry} className={className} />;
	}
	if (isLoading) {
		return (
			<div className={className} data-testid="query-state-loading">
				{loadingFallback ?? <SkeletonRows />}
			</div>
		);
	}
	return <>{children}</>;
}

interface QueryErrorProps {
	error: { message?: string };
	onRetry?: () => unknown;
	className?: string;
}

export function QueryError({ error, onRetry, className }: QueryErrorProps) {
	return (
		<div
			role="alert"
			className={cn(
				"flex flex-col items-center justify-center gap-3 p-6 text-center",
				className,
			)}
		>
			<div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2">
				<AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
				<p className="text-sm text-destructive">
					{error.message || "Failed to load data"}
				</p>
			</div>
			{onRetry && (
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => {
						onRetry();
					}}
				>
					Retry
				</Button>
			)}
		</div>
	);
}

interface SkeletonProps {
	className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
	return (
		<div
			className={cn("animate-pulse rounded-md bg-hover", className)}
			data-testid="skeleton"
		/>
	);
}

interface SkeletonRowsProps {
	count?: number;
	className?: string;
}

export function SkeletonRows({ count = 3, className }: SkeletonRowsProps) {
	return (
		<div className={cn("flex flex-col gap-2 p-4", className)}>
			{Array.from({ length: count }, (_, i) => (
				<Skeleton
					// biome-ignore lint/suspicious/noArrayIndexKey: skeletons are static placeholders
					key={i}
					className={cn(
						"h-4",
						i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-2/3",
					)}
				/>
			))}
		</div>
	);
}
