import type { DriverApprovalRequest } from "./driver-approval-request";
import type { DriverCallbacks } from "./driver-callbacks";
import type { DriverProcess } from "./driver-process";
import type { DriverSpawnOptions } from "./driver-spawn-options";

/**
 * Abstraction for a coding agent tool (Claude Code, Gemini CLI, etc.).
 *
 * Each driver encapsulates ALL protocol-specific logic:
 * - How to spawn the subprocess (CLI flags, protocol format)
 * - How to parse stdout (JSON protocol, plain text, etc.)
 * - How to handle internal permission/hook mechanics
 * - How to construct protocol-specific approval responses
 *
 * The orchestrator (ExecutorRepository) only interacts via this interface.
 */
export interface ICodingAgentDriver {
	readonly name: string;
	readonly defaultCommand: string;
	readonly displayName: string;
	readonly installHint: string;

	/** Spawn a new agent process. */
	spawn(options: DriverSpawnOptions): DriverProcess;

	/**
	 * Initialize the protocol, start log collection, and wire event callbacks.
	 * Called immediately after spawn(). The driver should:
	 * - Perform any protocol handshake (e.g., register hooks, set permission mode)
	 * - Start parsing stdout and emitting events via callbacks
	 */
	initialize(
		process: DriverProcess,
		processId: string,
		callbacks: DriverCallbacks,
	): Promise<void>;

	/** Send a user message to the running process. */
	sendMessage(process: DriverProcess, prompt: string): Promise<void>;

	/**
	 * Send synthetic error results for tools interrupted by a restart.
	 * Optional — not all agents support session resumption.
	 */
	sendInterruptedToolResults?(
		process: DriverProcess,
		tools: Array<{ toolId: string; toolName: string }>,
	): Promise<void>;

	/**
	 * Respond to an approval request.
	 * The driver uses protocolContext from the original request
	 * to construct its protocol-specific response.
	 */
	respondToApproval(
		process: DriverProcess,
		request: DriverApprovalRequest,
		approved: boolean,
		reason?: string,
	): Promise<void>;

	/**
	 * Send SIGINT to the underlying process.
	 *
	 * For agents like Claude Code in protocol mode, SIGINT only interrupts the
	 * current generation; the process stays alive. For one-shot drivers
	 * (codex-cli, gemini-cli) SIGINT typically terminates the process.
	 *
	 * Used internally by `gracefulStop()`. Callers that want a process-level
	 * shutdown should use `gracefulStop()` instead so that drivers behave
	 * consistently regardless of how their CLI handles SIGINT.
	 */
	interrupt(process: DriverProcess): void;

	/**
	 * Force-kill the process with SIGKILL.
	 *
	 * Used internally by `gracefulStop()` as the fallback when SIGINT does not
	 * cause the process to exit within the configured timeout.
	 */
	kill(process: DriverProcess): void;

	/**
	 * Shut the process down using the shared graceful pattern:
	 *   SIGINT → wait up to `timeoutMs` → SIGKILL.
	 *
	 * Resolves once the process has actually exited.
	 */
	gracefulStop(
		process: DriverProcess,
		options?: { timeoutMs?: number },
	): Promise<{ exitCode: number; killed: boolean; forced: boolean }>;

	/** Wait for the process to exit. */
	wait(process: DriverProcess): Promise<{ exitCode: number; killed: boolean }>;

	/**
	 * Spawn a one-shot structured output process and return streams without waiting.
	 * Optional — not all drivers support structured output.
	 */
	spawnStructured?(options: {
		workingDir: string;
		prompt: string;
		schema: Record<string, unknown>;
		model?: string;
		command?: string;
	}): {
		stdout: ReadableStream<Uint8Array>;
		stderr: ReadableStream<Uint8Array>;
		exited: Promise<number>;
	};

	/**
	 * Run a one-shot prompt with structured output (JSON schema validation).
	 * Optional — not all drivers support structured output.
	 */
	runStructured?<T>(options: {
		workingDir: string;
		prompt: string;
		schema: Record<string, unknown>;
		model?: string;
		command?: string;
	}): Promise<T | null>;
}
