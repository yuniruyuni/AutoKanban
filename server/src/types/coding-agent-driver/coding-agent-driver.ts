import type { ICodingAgentTurnRepository, IExecutionProcessLogsRepository } from "../repository";
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

	/** Spawn a new agent process. */
	spawn(options: DriverSpawnOptions): DriverProcess;

	/**
	 * Initialize the protocol, start log collection, and wire event callbacks.
	 * Called immediately after spawn(). The driver should:
	 * - Perform any protocol handshake (e.g., register hooks, set permission mode)
	 * - Start parsing stdout and emitting events via callbacks
	 * - Start collecting logs via logsRepo
	 */
	initialize(
		process: DriverProcess,
		processId: string,
		callbacks: DriverCallbacks,
		logsRepo: IExecutionProcessLogsRepository,
		codingAgentTurnRepo?: ICodingAgentTurnRepository,
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

	/** Interrupt current generation (SIGINT). Process stays alive. */
	interrupt(process: DriverProcess): void;

	/** Kill the process (SIGTERM). */
	kill(process: DriverProcess): void;

	/** Wait for the process to exit. */
	wait(process: DriverProcess): Promise<{ exitCode: number; killed: boolean }>;
}
