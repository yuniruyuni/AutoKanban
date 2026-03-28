import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useConversationFork } from "@/hooks/useConversationFork";
import { aggregateEntries, type DisplayEntry } from "@/lib/entry-aggregator";
import { trpc } from "@/trpc";
import { AggregatedToolGroup } from "./AggregatedToolGroup";
import { ChatMessage } from "./ChatMessage";
import { LoadingEntry } from "./LoadingEntry";
import { NextActionCard } from "./NextActionCard";
import type { ConversationEntry } from "./types";

interface ChatContainerProps {
	executionProcessId: string;
	isRunning: boolean;
	isAwaitingApproval?: boolean;
	sessionId?: string | null;
	onStartAgent?: () => void;
	onRetry?: () => void;
	onOpenDiffs?: () => void;
	onExecutionStarted?: (executionProcessId: string) => void;
}

/** Threshold of entries above which virtualization is enabled */
const VIRTUALIZATION_THRESHOLD = 50;

export function ChatContainer({
	executionProcessId,
	isRunning,
	isAwaitingApproval = false,
	sessionId,
	onStartAgent,
	onRetry,
	onOpenDiffs,
	onExecutionStarted,
}: ChatContainerProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const isAtBottomRef = useRef(true);

	const { data } = trpc.execution.getStructuredLogs.useQuery(
		{ executionProcessId },
		{ refetchInterval: isRunning ? 1000 : false },
	);

	const rawEntries = data?.entries ?? [];
	const isIdle = data?.isIdle ?? false;
	const displayEntries = useMemo(
		() => aggregateEntries(rawEntries),
		[rawEntries],
	);
	const { fork } = useConversationFork(sessionId);

	const handleEditMessage = useCallback(
		async (messageUuid: string, newText: string) => {
			const result = await fork(messageUuid, newText);
			if (result?.executionProcessId) {
				onExecutionStarted?.(result.executionProcessId);
			}
		},
		[fork, onExecutionStarted],
	);

	const isActuallyProcessing = isRunning && !isIdle && !isAwaitingApproval;
	const useVirtualized = displayEntries.length > VIRTUALIZATION_THRESHOLD;

	// Detect Plan Review mode (ExitPlanMode with pending status)
	const hasPendingPlan = useMemo(() => {
		return rawEntries.some((e) => {
			if (e.type.kind !== "tool") return false;
			const tool = e.type as import("./types").ToolEntry;
			return (
				tool.toolName === "ExitPlanMode" &&
				(tool.status === "pending_approval" ||
					(tool.action.type === "plan" &&
						(tool.action as import("./types").PlanAction).planStatus ===
							"pending"))
			);
		});
	}, [rawEntries]);

	// Track scroll position for auto-scroll
	const handleScroll = useCallback(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		const threshold = 100;
		isAtBottomRef.current =
			el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
	}, []);

	// Auto-scroll to bottom (disabled in Plan Review mode)
	useEffect(() => {
		if (hasPendingPlan) {
			// In Plan Review mode, scroll to the PlanCard instead of bottom
			const el = scrollContainerRef.current;
			if (el) {
				// Find the plan card element and scroll to it
				const planCard = el.querySelector("[data-plan-card]");
				if (planCard) {
					planCard.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			}
			return;
		}

		if (isAtBottomRef.current) {
			const el = scrollContainerRef.current;
			if (el) {
				el.scrollTop = el.scrollHeight;
			}
		}
	}, [hasPendingPlan]);

	if (useVirtualized) {
		return (
			<VirtualizedList
				scrollContainerRef={scrollContainerRef}
				displayEntries={displayEntries}
				rawEntries={rawEntries}
				isRunning={isRunning}
				isActuallyProcessing={isActuallyProcessing}
				sessionId={sessionId}
				onStartAgent={onStartAgent}
				onRetry={onRetry}
				onOpenDiffs={onOpenDiffs}
				onEditMessage={!isRunning ? handleEditMessage : undefined}
				onScroll={handleScroll}
			/>
		);
	}

	return (
		<div
			ref={scrollContainerRef}
			onScroll={handleScroll}
			className="flex flex-col gap-5 bg-primary p-6"
		>
			{rawEntries.length === 0 && !isRunning && (
				<div className="flex items-center justify-center py-8 text-muted">
					No messages yet
				</div>
			)}

			{displayEntries.map((item) =>
				"kind" in item && item.kind === "group" ? (
					<AggregatedToolGroup
						key={item.id}
						group={item}
						sessionId={sessionId}
						isProcessRunning={isRunning}
					/>
				) : (
					<ChatMessage
						key={item.id}
						entry={item as ConversationEntry}
						sessionId={sessionId}
						onEditMessage={!isRunning ? handleEditMessage : undefined}
						isProcessRunning={isRunning}
					/>
				),
			)}

			{isActuallyProcessing && <LoadingEntry />}

			{!isRunning && rawEntries.length > 0 && (
				<NextActionCard
					entries={rawEntries}
					onStartAgent={onStartAgent}
					onRetry={onRetry}
					onOpenDiffs={onOpenDiffs}
				/>
			)}
		</div>
	);
}

/** Virtualized list for large conversations */
function VirtualizedList({
	scrollContainerRef,
	displayEntries,
	rawEntries,
	isRunning,
	isActuallyProcessing,
	sessionId,
	onStartAgent,
	onRetry,
	onOpenDiffs,
	onEditMessage,
	onScroll,
}: {
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	displayEntries: DisplayEntry[];
	rawEntries: Array<{ type: { kind: string } }>;
	isRunning: boolean;
	isActuallyProcessing: boolean;
	sessionId?: string | null;
	onStartAgent?: () => void;
	onRetry?: () => void;
	onOpenDiffs?: () => void;
	onEditMessage?: (messageUuid: string, newText: string) => void;
	onScroll: () => void;
}) {
	// Add extra virtual items for loading and next action card
	const extraCount =
		(isActuallyProcessing ? 1 : 0) +
		(!isRunning && rawEntries.length > 0 ? 1 : 0);
	const totalCount = displayEntries.length + extraCount;

	const virtualizer = useVirtualizer({
		count: totalCount,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: () => 60,
		overscan: 10,
	});

	return (
		<div
			ref={scrollContainerRef}
			onScroll={onScroll}
			className="h-full overflow-y-auto"
		>
			<div
				className="relative w-full p-6"
				style={{ height: `${virtualizer.getTotalSize()}px` }}
			>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const index = virtualRow.index;

					let content: React.ReactNode;
					if (index < displayEntries.length) {
						const item = displayEntries[index];
						content =
							"kind" in item && item.kind === "group" ? (
								<AggregatedToolGroup
									group={item}
									sessionId={sessionId}
									isProcessRunning={isRunning}
								/>
							) : (
								<ChatMessage
									entry={item as ConversationEntry}
									sessionId={sessionId}
									onEditMessage={onEditMessage}
									isProcessRunning={isRunning}
								/>
							);
					} else if (index === displayEntries.length && isActuallyProcessing) {
						content = <LoadingEntry />;
					} else {
						content = (
							<NextActionCard
								entries={rawEntries as ConversationEntry[]}
								onStartAgent={onStartAgent}
								onRetry={onRetry}
								onOpenDiffs={onOpenDiffs}
							/>
						);
					}

					return (
						<div
							key={virtualRow.key}
							ref={virtualizer.measureElement}
							data-index={index}
							className="absolute left-0 top-0 w-full px-6 pb-5"
							style={{ transform: `translateY(${virtualRow.start}px)` }}
						>
							{content}
						</div>
					);
				})}
			</div>
		</div>
	);
}
