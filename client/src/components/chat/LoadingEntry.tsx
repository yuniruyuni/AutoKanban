export function LoadingEntry() {
	return (
		<div className="flex gap-3">
			{/* Avatar skeleton */}
			<div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-hover" />
			{/* Text line skeletons */}
			<div className="flex flex-1 flex-col gap-2 pt-1">
				<div className="h-3 w-3/4 animate-pulse rounded bg-hover" />
				<div className="h-3 w-1/2 animate-pulse rounded bg-hover" />
				<div className="h-3 w-2/3 animate-pulse rounded bg-hover" />
			</div>
		</div>
	);
}
