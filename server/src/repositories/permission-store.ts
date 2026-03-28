/**
 * In-memory store for pending permission requests from Claude Code.
 * Tracks permission requests per process and allows approve/deny/timeout operations.
 */

import type { PendingPermission } from "../models/common";
import type { IPermissionStoreRepository } from "../types/repository";

export type { PendingPermission };

export type PermissionStatus = "pending" | "approved" | "denied" | "timed_out";

export class PermissionStore implements IPermissionStoreRepository {
	private pending = new Map<string, PendingPermission>();

	add(permission: PendingPermission): void {
		this.pending.set(permission.requestId, permission);
	}

	get(requestId: string): PendingPermission | undefined {
		return this.pending.get(requestId);
	}

	listByProcess(processId: string): PendingPermission[] {
		return Array.from(this.pending.values()).filter(
			(p) => p.processId === processId,
		);
	}

	listBySession(sessionId: string): PendingPermission[] {
		return Array.from(this.pending.values()).filter(
			(p) => p.sessionId === sessionId,
		);
	}

	remove(requestId: string): boolean {
		return this.pending.delete(requestId);
	}

	clear(): void {
		this.pending.clear();
	}
}

export const permissionStore = new PermissionStore();
