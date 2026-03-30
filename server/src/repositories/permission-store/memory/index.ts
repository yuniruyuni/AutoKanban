import type { PendingPermission } from "../../../models/permission";
import type { ServiceCtx } from "../../common";
import type { PermissionStoreRepository } from "../repository";

export class PermissionStore implements PermissionStoreRepository {
	private pending = new Map<string, PendingPermission>();

	add(_ctx: ServiceCtx, permission: PendingPermission): void {
		this.pending.set(permission.requestId, permission);
	}

	get(_ctx: ServiceCtx, requestId: string): PendingPermission | undefined {
		return this.pending.get(requestId);
	}

	listByProcess(_ctx: ServiceCtx, processId: string): PendingPermission[] {
		return Array.from(this.pending.values()).filter(
			(p) => p.processId === processId,
		);
	}

	listBySession(_ctx: ServiceCtx, sessionId: string): PendingPermission[] {
		return Array.from(this.pending.values()).filter(
			(p) => p.sessionId === sessionId,
		);
	}

	remove(_ctx: ServiceCtx, requestId: string): boolean {
		return this.pending.delete(requestId);
	}

	clear(_ctx: ServiceCtx): void {
		this.pending.clear();
	}
}

export const permissionStore = new PermissionStore();
