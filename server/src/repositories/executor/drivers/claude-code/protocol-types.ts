/**
 * TypeScript types for the Claude Code control protocol.
 *
 * Defined based on observed behavior, public documentation, and
 * interoperability testing. These types describe the JSON format
 * used in stdin/stdout control messages between the SDK host and
 * the Claude Code CLI subprocess.
 *
 * Maintained manually — update when protocol behavior changes.
 */

// ============================================
// Permission Mode
// ============================================

export type PermissionMode =
	| "default"
	| "acceptEdits"
	| "bypassPermissions"
	| "plan"
	| "delegate"
	| "dontAsk";

// ============================================
// Permission Update (updatedPermissions array items)
// ============================================

/** Discriminated union on "type" field. */
export type PermissionUpdate =
	| PermissionUpdateSetMode
	| PermissionUpdateAddRules
	| PermissionUpdateReplaceRules
	| PermissionUpdateRemoveRules
	| PermissionUpdateAddDirectories
	| PermissionUpdateRemoveDirectories;

export type PermissionUpdateDestination = "session" | "user" | "project";

export interface PermissionUpdateSetMode {
	type: "setMode";
	mode: PermissionMode;
	destination: PermissionUpdateDestination;
}

export interface PermissionUpdateAddRules {
	type: "addRules";
	rules: PermissionRule[];
	behavior: PermissionBehavior;
	destination: PermissionUpdateDestination;
}

export interface PermissionUpdateReplaceRules {
	type: "replaceRules";
	rules: PermissionRule[];
	behavior: PermissionBehavior;
	destination: PermissionUpdateDestination;
}

export interface PermissionUpdateRemoveRules {
	type: "removeRules";
	rules: PermissionRule[];
	behavior: PermissionBehavior;
	destination: PermissionUpdateDestination;
}

export interface PermissionUpdateAddDirectories {
	type: "addDirectories";
	directories: string[];
	destination: PermissionUpdateDestination;
}

export interface PermissionUpdateRemoveDirectories {
	type: "removeDirectories";
	directories: string[];
	destination: PermissionUpdateDestination;
}

export type PermissionBehavior = "allow" | "deny";

export interface PermissionRule {
	tool_name: string;
	[key: string]: unknown;
}

// ============================================
// Permission Result (canUseTool response body)
// ============================================

export type PermissionResult = PermissionResultAllow | PermissionResultDeny;

export interface PermissionResultAllow {
	behavior: "allow";
	updatedInput?: Record<string, unknown>;
	updatedPermissions?: PermissionUpdate[];
	toolUseID?: string;
}

export interface PermissionResultDeny {
	behavior: "deny";
	message: string;
	interrupt?: boolean;
	toolUseID?: string;
}

// ============================================
// Hook Response (hookCallback response body)
// ============================================

export interface PreToolUseHookOutput {
	hookEventName: "PreToolUse";
	permissionDecision?: "allow" | "deny" | "ask";
	permissionDecisionReason?: string;
	updatedInput?: Record<string, unknown>;
	additionalContext?: string;
}
