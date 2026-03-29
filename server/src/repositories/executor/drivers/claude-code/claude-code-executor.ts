import { randomUUID } from "node:crypto";
import type { FileSink, Subprocess } from "bun";

// ============================================
// Types
// ============================================

export interface ClaudeCodeOptions {
	workingDir: string;
	prompt: string;
	dangerouslySkipPermissions?: boolean;
	model?: string;
}

export type PermissionMode =
	| "bypassPermissions"
	| "default"
	| "acceptEdits"
	| "plan";

export interface ClaudeCodeProtocolOptions {
	workingDir: string;
	dangerouslySkipPermissions?: boolean;
	model?: string;
	resumeSessionId?: string;
	resumeMessageId?: string;
	permissionMode?: PermissionMode;
}

export interface ClaudeCodeProcess {
	proc: Subprocess<"pipe", "pipe", "pipe">;
	stdin: FileSink;
	stdout: ReadableStream<Uint8Array>;
	stderr: ReadableStream<Uint8Array>;
}

export interface ClaudeCodeResult {
	exitCode: number;
	killed: boolean;
}

// Use specific version for stability
const CLAUDE_CODE_PACKAGE = "@anthropic-ai/claude-code@2.1.32";

// Hook callback ID for auto-approving non-ExitPlanMode tools
export const AUTO_APPROVE_CALLBACK_ID = "AUTO_APPROVE_CALLBACK_ID";

// Hook callback ID for ExitPlanMode approval flow
export const TOOL_APPROVAL_CALLBACK_ID = "tool_approval";

// ============================================
// Control Protocol Message Types
// ============================================

interface ControlRequest {
	type: "control_request";
	request_id: string;
	request: {
		subtype: string;
		[key: string]: unknown;
	};
}

interface UserMessage {
	type: "user";
	message: {
		role: "user";
		content: string;
	};
}

interface ToolResultContent {
	type: "tool_result";
	tool_use_id: string;
	content: string;
	is_error?: boolean;
}

interface UserMessageWithToolResult {
	type: "user";
	message: {
		role: "user";
		content: ToolResultContent[];
	};
}

// ============================================
// Claude Code Executor
// ============================================

/**
 * Spawns and manages Claude Code CLI processes.
 * Supports both print mode (legacy) and protocol mode (new).
 *
 * Protocol mode enables:
 * - Bidirectional stdin/stdout communication
 * - Session resumption with --resume flag
 * - Control protocol for permission handling
 */
export class ClaudeCodeExecutor {
	/**
	 * Spawns a new Claude Code process in print mode (legacy one-shot).
	 * The prompt is passed as a command line argument.
	 */
	spawn(options: ClaudeCodeOptions): ClaudeCodeProcess {
		const args = this.buildPrintArgs(options);
		return this.spawnProcess(options.workingDir, args);
	}

	/**
	 * Spawns a new Claude Code process in protocol mode.
	 * The prompt is sent via stdin after initialization.
	 */
	spawnProtocol(options: ClaudeCodeProtocolOptions): ClaudeCodeProcess {
		const args = this.buildProtocolArgs(options);
		return this.spawnProcess(options.workingDir, args);
	}

	/**
	 * Initialize the Control Protocol.
	 * Must be called immediately after spawning in protocol mode.
	 */
	async initialize(
		process: ClaudeCodeProcess,
		permissionMode: PermissionMode = "default",
	): Promise<void> {
		// Register PreToolUse hooks for all permission modes.
		// ExitPlanMode → "tool_approval" hook (triggers user approval via can_use_tool).
		// All other tools → auto-approve hook (immediately allowed).
		// Both hooks are registered even in plan mode so that after ExitPlanMode
		// approval (when mode switches to bypassPermissions), subsequent tools
		// are auto-approved via the hook callback.
		const hooks = {
			PreToolUse: [
				{
					matcher: "^ExitPlanMode$",
					hookCallbackIds: [TOOL_APPROVAL_CALLBACK_ID],
				},
				{
					matcher: "^(?!ExitPlanMode$).*",
					hookCallbackIds: [AUTO_APPROVE_CALLBACK_ID],
				},
			],
		};

		// Send initialize request with hooks
		const initRequest: ControlRequest = {
			type: "control_request",
			request_id: randomUUID(),
			request: {
				subtype: "initialize",
				hooks,
			},
		};
		await this.writeMessage(process, initRequest);

		// Set permission mode via control protocol
		// (CLI flag --permission-mode may not be sufficient alone)
		const permRequest: ControlRequest = {
			type: "control_request",
			request_id: randomUUID(),
			request: {
				subtype: "set_permission_mode",
				mode: permissionMode,
			},
		};
		await this.writeMessage(process, permRequest);
	}

	/**
	 * Sends a permission response (approve/deny) for a pending permission request.
	 * Uses different response formats based on the request subtype:
	 * - "permission_request" (legacy/no-hooks): { subtype: "permission_response", approved, reason }
	 * - "canUseTool" (hooks-based): { subtype: "success", response: { behavior: "allow/deny" } }
	 */
	async sendPermissionResponse(
		process: ClaudeCodeProcess,
		requestId: string,
		approved: boolean,
		requestSubtype?: string,
		reason?: string,
		updatedPermissions?: Array<{
			type: string;
			mode?: string;
			destination?: string;
		}>,
		toolInput?: Record<string, unknown>,
	): Promise<void> {
		if (requestSubtype === "permission_request") {
			// Legacy format for permission_request subtype
			const response = {
				type: "control_response",
				request_id: requestId,
				response: {
					subtype: "permission_response",
					approved,
					...(reason ? { reason } : {}),
				},
			};
			await this.writeMessage(process, response);
		} else {
			// New format for canUseTool subtype.
			if (approved) {
				const permissionResult: Record<string, unknown> = {
					behavior: "allow",
					// updatedInput is required by Claude Code's Zod schema for
					// "allow" responses. Always include it so the tool executes
					// with its original input preserved.
					updatedInput: toolInput ?? {},
				};
				if (updatedPermissions) {
					permissionResult.updatedPermissions = updatedPermissions;
				}
				const response = {
					type: "control_response",
					request_id: requestId,
					response: {
						subtype: "success",
						request_id: requestId,
						response: permissionResult,
					},
				};
				await this.writeMessage(process, response);
			} else {
				const response = {
					type: "control_response",
					request_id: requestId,
					response: {
						subtype: "success",
						request_id: requestId,
						response: {
							behavior: "deny",
							message: reason
								? `The user doesn't want to proceed with this tool use. The tool use was rejected. To tell you how to proceed, the user said: ${reason}`
								: "The user doesn't want to proceed with this tool use. The tool use was rejected.",
							interrupt: false,
						},
					},
				};
				await this.writeMessage(process, response);
			}
		}
	}

	/**
	 * Sends a hook callback response (for PreToolUse hooks).
	 * Used to respond to hookCallback control requests.
	 * "allow" auto-approves, "ask" triggers a canUseTool follow-up from Claude.
	 */
	async sendHookResponse(
		process: ClaudeCodeProcess,
		requestId: string,
		decision: "allow" | "deny" | "ask",
		reason?: string,
	): Promise<void> {
		const response = {
			type: "control_response",
			request_id: requestId,
			response: {
				subtype: "success",
				request_id: requestId,
				response: {
					hookSpecificOutput: {
						hookEventName: "PreToolUse",
						permissionDecision: decision,
						permissionDecisionReason:
							reason ?? (decision === "allow" ? "Approved by SDK" : ""),
					},
				},
			},
		};
		await this.writeMessage(process, response);
	}

	/**
	 * Sends a user message to the Claude Code process.
	 * Use this in protocol mode to send prompts after initialization.
	 */
	async sendUserMessage(
		process: ClaudeCodeProcess,
		prompt: string,
	): Promise<void> {
		const message: UserMessage = {
			type: "user",
			message: {
				role: "user",
				content: prompt,
			},
		};
		await this.writeMessage(process, message);
	}

	/**
	 * Sends synthetic tool results for interrupted tools.
	 * Use this when resuming a session that had pending Task tools.
	 */
	async sendToolResults(
		process: ClaudeCodeProcess,
		toolResults: Array<{ toolId: string; content: string; isError: boolean }>,
	): Promise<void> {
		if (toolResults.length === 0) return;

		const content: ToolResultContent[] = toolResults.map((result) => ({
			type: "tool_result",
			tool_use_id: result.toolId,
			content: result.content,
			is_error: result.isError,
		}));

		const message: UserMessageWithToolResult = {
			type: "user",
			message: {
				role: "user",
				content,
			},
		};
		await this.writeMessage(process, message);
	}

	/**
	 * Waits for the process to complete and returns the result.
	 */
	async wait(process: ClaudeCodeProcess): Promise<ClaudeCodeResult> {
		const exitCode = await process.proc.exited;
		return {
			exitCode,
			killed: process.proc.killed,
		};
	}

	/**
	 * Kills the process with SIGTERM.
	 */
	kill(process: ClaudeCodeProcess): void {
		process.proc.kill();
	}

	/**
	 * Interrupts the current generation with SIGINT.
	 * The process stays alive and becomes idle, ready for new messages.
	 * This preserves the full conversation context.
	 */
	interrupt(process: ClaudeCodeProcess): void {
		process.proc.kill(2); // SIGINT
	}

	// ============================================
	// Private Methods
	// ============================================

	private spawnProcess(workingDir: string, args: string[]): ClaudeCodeProcess {
		// Use bunx instead of npx for better performance and compatibility with Bun.spawn
		const cmd = ["bunx", CLAUDE_CODE_PACKAGE, ...args];

		const proc = Bun.spawn({
			cmd,
			cwd: workingDir,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				// Ensure non-interactive mode
				CI: "true",
				// Suppress npm noise
				NPM_CONFIG_LOGLEVEL: "error",
			},
		});

		return {
			proc,
			stdin: proc.stdin,
			stdout: proc.stdout,
			stderr: proc.stderr,
		};
	}

	/**
	 * Write a JSON message to the process stdin.
	 */
	private async writeMessage(
		process: ClaudeCodeProcess,
		message: object,
	): Promise<void> {
		const json = JSON.stringify(message);
		process.stdin.write(`${json}\n`);
		process.stdin.flush();
	}

	/**
	 * Builds command line arguments for print mode (legacy).
	 */
	private buildPrintArgs(options: ClaudeCodeOptions): string[] {
		const args: string[] = [
			"--print",
			"--output-format=stream-json",
			"--verbose",
		];

		if (options.dangerouslySkipPermissions) {
			args.push("--dangerously-skip-permissions");
		}

		if (options.model) {
			args.push("--model", options.model);
		}

		// Add the prompt as the final argument
		args.push(options.prompt);

		return args;
	}

	/**
	 * Builds command line arguments for protocol mode.
	 * Prompt is NOT included - it's sent via stdin.
	 */
	private buildProtocolArgs(options: ClaudeCodeProtocolOptions): string[] {
		const args: string[] = [
			"-p", // Protocol mode
			"--output-format=stream-json",
			"--input-format=stream-json",
			"--verbose",
			// CLIフラグでpermission制御を有効化
			"--permission-prompt-tool=stdio",
			`--permission-mode=${options.permissionMode ?? "default"}`,
			"--disallowedTools=AskUserQuestion",
		];

		if (options.model) {
			args.push("--model", options.model);
		}

		// Resume options for continuing a previous session
		if (options.resumeSessionId) {
			args.push("--resume", options.resumeSessionId);

			if (options.resumeMessageId) {
				args.push("--resume-session-at", options.resumeMessageId);
			}
		}

		return args;
	}
}
