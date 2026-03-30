import type { ILogger } from "../../../../infra/logger/types";
import type { ClaudeControlRequestMessage } from "../../../../models/claude-protocol";
import {
	type ClaudeAssistantMessage,
	ClaudeJsonParser,
	extractSummaryFromContent,
	type ParsedResult,
} from "../../../../models/conversation/claude-json-parser";
import { createServiceCtx } from "../../../common";
import { type LogStore, logStoreManager } from "../../../log-store";

export type IdleCallback = (processId: string) => void;
export type ApprovalRequestCallback = (
	processId: string,
	request: ClaudeControlRequestMessage,
) => void;

export type AutoApproveCallback = (
	processId: string,
	request: ClaudeControlRequestMessage,
) => void;

export type HookCallback = (
	processId: string,
	request: ClaudeControlRequestMessage,
) => void;

export type LogDataCallback = (
	processId: string,
	source: "stdout" | "stderr",
	data: string,
) => void;

export type SessionInfoCallback = (
	processId: string,
	info: { resumeToken: string | null; messageToken: string | null },
) => void;

export type SummaryCallback = (processId: string, summary: string) => void;

/**
 * Collects logs from protocol mode process streams.
 * Parses JSON output to extract session IDs, message IDs, and detect idle state.
 */
export class ProtocolLogCollector {
	private idleCallbacks: IdleCallback[] = [];
	private approvalRequestCallbacks: ApprovalRequestCallback[] = [];
	private autoApproveCallbacks: AutoApproveCallback[] = [];
	private hookCallbacks: HookCallback[] = [];
	private logDataCallbacks: LogDataCallback[] = [];
	private sessionInfoCallbacks: SessionInfoCallback[] = [];
	private summaryCallbacks: SummaryCallback[] = [];

	private logger: ILogger;

	constructor(logger: ILogger) {
		this.logger = logger;
	}

	/**
	 * Registers a callback to be called when the process becomes idle (waiting for input).
	 */
	onIdle(callback: IdleCallback): void {
		this.idleCallbacks.push(callback);
	}

	/**
	 * Registers a callback for ExitPlanMode permission requests (approval flow).
	 */
	onApprovalRequest(callback: ApprovalRequestCallback): void {
		this.approvalRequestCallbacks.push(callback);
	}

	/**
	 * Registers a callback for auto-approving non-ExitPlanMode permission requests.
	 */
	onAutoApprove(callback: AutoApproveCallback): void {
		this.autoApproveCallbacks.push(callback);
	}

	/**
	 * Registers a callback for hookCallback control requests.
	 */
	onHookCallback(callback: HookCallback): void {
		this.hookCallbacks.push(callback);
	}

	/**
	 * Registers a callback for log data (stdout/stderr).
	 */
	onLogData(callback: LogDataCallback): void {
		this.logDataCallbacks.push(callback);
	}

	/**
	 * Registers a callback for session info updates (session_id, message_id).
	 */
	onSessionInfo(callback: SessionInfoCallback): void {
		this.sessionInfoCallbacks.push(callback);
	}

	/**
	 * Registers a callback for summary extraction.
	 */
	onSummary(callback: SummaryCallback): void {
		this.summaryCallbacks.push(callback);
	}

	/**
	 * Starts collecting logs from stdout/stderr with protocol parsing.
	 */
	collect(
		processId: string,
		stdout: ReadableStream<Uint8Array>,
		stderr: ReadableStream<Uint8Array>,
	): void {
		const svcCtx = createServiceCtx();
		const store = logStoreManager.create(svcCtx, processId);
		this.collectProtocolStream(processId, stdout, store);
		this.collectStderrStream(processId, stderr, store);
	}

	/**
	 * Collects stderr data normally.
	 */
	private async collectStderrStream(
		processId: string,
		stream: ReadableStream<Uint8Array>,
		store: LogStore,
	): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		const svcCtx = createServiceCtx();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const data = decoder.decode(value, { stream: true });

				const entry = {
					timestamp: new Date(),
					source: "stderr" as const,
					data,
				};

				store.append(svcCtx, entry);
				this.notifyLogDataCallbacks(processId, "stderr", data);
			}
		} catch (error) {
			this.logger.error("Error collecting stderr:", error);
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * Collects data from stdout with JSON parsing.
	 * Extracts session_id and message_id and stores them in CodingAgentTurn.
	 */
	private async collectProtocolStream(
		processId: string,
		stream: ReadableStream<Uint8Array>,
		store: LogStore,
	): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		const parser = new ClaudeJsonParser();
		const svcCtx = createServiceCtx();
		let buffer = "";
		let lastAssistantContent: ClaudeAssistantMessage | null = null;

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Process complete lines
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					if (!line.trim()) continue;

					const entry = {
						timestamp: new Date(),
						source: "stdout" as const,
						data: line,
					};

					store.append(svcCtx, entry);
					this.notifyLogDataCallbacks(processId, "stdout", line);

					// Parse the JSON line
					const results = parser.parse(line);
					this.handleParsedResults(processId, results);

					// Track assistant messages for summary extraction
					for (const result of results) {
						if (result.kind === "message" && result.data.type === "assistant") {
							lastAssistantContent = result.data as ClaudeAssistantMessage;
						}
					}
				}
			}

			// Extract summary from last assistant message
			if (lastAssistantContent) {
				const summary = extractSummaryFromContent(
					lastAssistantContent.message.content,
				);
				if (summary) {
					this.notifySummaryCallbacks(processId, summary);
				}
			}
		} catch (error) {
			this.logger.error("Error collecting protocol stdout:", error);
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * Handles parsed results from the JSON parser.
	 * Updates CodingAgentTurn with session_id and message_id.
	 */
	private handleParsedResults(
		processId: string,
		results: ParsedResult[],
	): void {
		let resumeToken: string | null = null;
		let messageToken: string | null = null;

		for (const result of results) {
			switch (result.kind) {
				case "session_id":
					resumeToken = result.value;
					break;

				case "message_id":
					messageToken = result.value;
					break;

				case "result":
					// Notify idle callbacks - Claude is now waiting for input
					this.notifyIdleCallbacks(processId);
					break;

				case "control_request": {
					const request = result.data;
					const subtype = request.request.subtype;

					if (
						subtype === "permission_request" ||
						subtype === "canUseTool" ||
						subtype === "can_use_tool"
					) {
						const toolName = (request.request.tool_name as string) ?? "unknown";

						if (toolName === "ExitPlanMode") {
							this.notifyApprovalRequestCallbacks(processId, request);
						} else {
							this.notifyAutoApproveCallbacks(processId, request);
						}
					} else if (
						subtype === "hookCallback" ||
						subtype === "hook_callback"
					) {
						this.notifyHookCallbacks(processId, request);
					} else {
						this.logger.warn("Unhandled control_request subtype", {
							processId,
							subtype,
						});
					}
					break;
				}

				case "error":
					this.logger.error("Parse error:", result.error);
					break;
			}
		}

		if (resumeToken !== null || messageToken !== null) {
			this.notifySessionInfoCallbacks(processId, {
				resumeToken,
				messageToken,
			});
		}
	}

	/**
	 * Notifies all idle callbacks when a process becomes idle.
	 */
	private notifyIdleCallbacks(processId: string): void {
		for (const callback of this.idleCallbacks) {
			try {
				callback(processId);
			} catch (err) {
				this.logger.error("Error in idle callback:", err);
			}
		}
	}

	/**
	 * Notifies auto-approve callbacks for non-ExitPlanMode permission requests.
	 */
	private notifyAutoApproveCallbacks(
		processId: string,
		request: ClaudeControlRequestMessage,
	): void {
		for (const callback of this.autoApproveCallbacks) {
			try {
				callback(processId, request);
			} catch (err) {
				this.logger.error("Error in auto-approve callback:", err);
			}
		}
	}

	/**
	 * Notifies hook callback handlers for hookCallback control requests.
	 */
	private notifyHookCallbacks(
		processId: string,
		request: ClaudeControlRequestMessage,
	): void {
		for (const callback of this.hookCallbacks) {
			try {
				callback(processId, request);
			} catch (err) {
				this.logger.error("Error in hook callback:", err);
			}
		}
	}

	/**
	 * Notifies approval request callbacks for ExitPlanMode permission requests.
	 */
	private notifyApprovalRequestCallbacks(
		processId: string,
		request: ClaudeControlRequestMessage,
	): void {
		for (const callback of this.approvalRequestCallbacks) {
			try {
				callback(processId, request);
			} catch (err) {
				this.logger.error("Error in approval request callback:", err);
			}
		}
	}

	private notifyLogDataCallbacks(
		processId: string,
		source: "stdout" | "stderr",
		data: string,
	): void {
		for (const callback of this.logDataCallbacks) {
			try {
				callback(processId, source, data);
			} catch (err) {
				this.logger.error("Error in log data callback:", err);
			}
		}
	}

	private notifySessionInfoCallbacks(
		processId: string,
		info: { resumeToken: string | null; messageToken: string | null },
	): void {
		for (const callback of this.sessionInfoCallbacks) {
			try {
				callback(processId, info);
			} catch (err) {
				this.logger.error("Error in session info callback:", err);
			}
		}
	}

	private notifySummaryCallbacks(processId: string, summary: string): void {
		for (const callback of this.summaryCallbacks) {
			try {
				callback(processId, summary);
			} catch (err) {
				this.logger.error("Error in summary callback:", err);
			}
		}
	}
}
