import type { TaskStatus } from "@/store/task";

export const STATUS_CONFIG: Record<
	TaskStatus,
	{ label: string; color: string; bgColor: string }
> = {
	todo: {
		label: "Todo",
		color: "text-secondary-foreground",
		bgColor: "bg-hover",
	},
	inprogress: {
		label: "In Progress",
		color: "text-white",
		bgColor: "bg-info",
	},
	inreview: {
		label: "In Review",
		color: "text-white",
		bgColor: "bg-[#7C3AED]",
	},
	done: {
		label: "Done",
		color: "text-white",
		bgColor: "bg-success",
	},
	cancelled: {
		label: "Cancelled",
		color: "text-white",
		bgColor: "bg-secondary-foreground",
	},
};

export const KANBAN_COLUMNS: TaskStatus[] = [
	"todo",
	"inprogress",
	"inreview",
	"done",
	"cancelled",
];
