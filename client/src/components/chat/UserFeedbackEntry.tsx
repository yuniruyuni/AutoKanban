import { ShieldX } from "lucide-react";
import type { UserFeedbackEntry as UserFeedbackEntryType } from "./types";

interface UserFeedbackEntryProps {
	entry: UserFeedbackEntryType;
}

export function UserFeedbackEntry({ entry }: UserFeedbackEntryProps) {
	return (
		<div className="ml-9 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
			<ShieldX className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
			<div>
				<p className="text-sm font-medium text-red-700">
					Denied: {entry.toolName}
				</p>
				<p className="mt-1 text-sm text-red-600">{entry.reason}</p>
			</div>
		</div>
	);
}
