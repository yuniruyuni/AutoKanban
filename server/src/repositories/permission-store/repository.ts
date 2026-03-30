import type { PendingPermission } from "../../models/common";
import type { ServiceCtx } from "../../types/db-capability";

export interface PermissionStoreRepository {
	add(ctx: ServiceCtx, permission: PendingPermission): void;
	get(ctx: ServiceCtx, requestId: string): PendingPermission | undefined;
	listByProcess(ctx: ServiceCtx, processId: string): PendingPermission[];
	listBySession(ctx: ServiceCtx, sessionId: string): PendingPermission[];
	remove(ctx: ServiceCtx, requestId: string): boolean;
	clear(ctx: ServiceCtx): void;
}
