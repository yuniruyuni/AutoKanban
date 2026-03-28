import type { ConversationEntry } from "@/components/chat/types";

export interface AggregatedGroup {
	kind: "group";
	id: string;
	actionType: string;
	entries: ConversationEntry[];
	label: string;
}

export type DisplayEntry = ConversationEntry | AggregatedGroup;

/** Action types that can be aggregated when consecutive */
const AGGREGATABLE_TYPES = new Set([
	"file_read",
	"search",
	"web_fetch",
	"file_edit",
	"todo_management",
]);

function getToolActionType(entry: ConversationEntry): string | null {
	if (entry.type.kind !== "tool") return null;
	return entry.type.action.type;
}

function getToolPath(entry: ConversationEntry): string | null {
	if (entry.type.kind !== "tool") return null;
	const action = entry.type.action;
	if (
		action.type === "file_edit" ||
		action.type === "file_read" ||
		action.type === "file_write"
	) {
		return action.path;
	}
	return null;
}

function buildGroupLabel(
	actionType: string,
	entries: ConversationEntry[],
): string {
	switch (actionType) {
		case "file_read":
			return `Read ${entries.length} files`;
		case "search":
			return `Searched ${entries.length} patterns`;
		case "web_fetch":
			return `Fetched ${entries.length} URLs`;
		case "file_edit": {
			const paths = new Set(entries.map((e) => getToolPath(e)).filter(Boolean));
			if (paths.size === 1) {
				const path = paths.values().next().value;
				return `Edited ${path} (${entries.length} changes)`;
			}
			return `Edited ${entries.length} files`;
		}
		case "todo_management":
			return `Updated Todos (${entries.length} updates)`;
		default:
			return `${entries.length} operations`;
	}
}

/**
 * Aggregate consecutive same-type tool entries into collapsible groups.
 * Minimum 2 consecutive entries of the same type to form a group.
 */
export function aggregateEntries(entries: ConversationEntry[]): DisplayEntry[] {
	const result: DisplayEntry[] = [];
	let i = 0;

	while (i < entries.length) {
		const current = entries[i];
		const actionType = getToolActionType(current);

		if (!actionType || !AGGREGATABLE_TYPES.has(actionType)) {
			result.push(current);
			i++;
			continue;
		}

		// For file_edit, group by same path
		const groupKey =
			actionType === "file_edit"
				? `${actionType}:${getToolPath(current)}`
				: actionType;

		// Collect consecutive entries of the same type
		const group: ConversationEntry[] = [current];
		let j = i + 1;
		while (j < entries.length) {
			const next = entries[j];
			const nextActionType = getToolActionType(next);
			if (!nextActionType) break;

			const nextGroupKey =
				nextActionType === "file_edit"
					? `${nextActionType}:${getToolPath(next)}`
					: nextActionType;

			if (nextGroupKey !== groupKey) break;
			group.push(next);
			j++;
		}

		if (group.length >= 2) {
			result.push({
				kind: "group",
				id: `group-${group[0].id}`,
				actionType,
				entries: group,
				label: buildGroupLabel(actionType, group),
			});
		} else {
			result.push(current);
		}

		i = j;
	}

	return result;
}
