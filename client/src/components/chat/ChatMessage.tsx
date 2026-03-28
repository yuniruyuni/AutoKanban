import { AssistantMessage } from "./AssistantMessage";
import { ErrorMessage } from "./ErrorMessage";
import { SystemMessage } from "./SystemMessage";
import { ThinkingMessage } from "./ThinkingMessage";
import { ToolEntryComponent } from "./ToolEntry";
import type { ConversationEntry, ToolEntry, UserFeedbackEntry } from "./types";
import { UserFeedbackEntry as UserFeedbackComponent } from "./UserFeedbackEntry";
import { UserMessage } from "./UserMessage";

interface ChatMessageProps {
	entry: ConversationEntry;
	sessionId?: string | null;
	onEditMessage?: (messageUuid: string, newText: string) => void;
	isProcessRunning?: boolean;
}

export function ChatMessage({
	entry,
	sessionId,
	onEditMessage,
	isProcessRunning,
}: ChatMessageProps) {
	switch (entry.type.kind) {
		case "user_message":
			return (
				<UserMessage
					content={{ type: "text", text: entry.type.text }}
					messageUuid={entry.messageUuid}
					onEdit={onEditMessage}
				/>
			);
		case "assistant_message":
			return (
				<AssistantMessage content={{ type: "text", text: entry.type.text }} />
			);
		case "thinking":
			return (
				<ThinkingMessage
					content={{ type: "thinking", thinking: entry.type.thinking }}
				/>
			);
		case "tool":
			return (
				<ToolEntryComponent
					entry={entry.type as ToolEntry}
					sessionId={sessionId}
					isProcessRunning={isProcessRunning}
				/>
			);
		case "system_message":
			return (
				<SystemMessage content={{ type: "system", text: entry.type.text }} />
			);
		case "error":
			return (
				<ErrorMessage
					content={{ type: "error", message: entry.type.message }}
				/>
			);
		case "user_feedback":
			return <UserFeedbackComponent entry={entry.type as UserFeedbackEntry} />;
		default:
			return null;
	}
}
