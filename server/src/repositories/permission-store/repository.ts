import type { PendingPermission } from "../../models/permission";
import type { ServiceCtx } from "../common";

export interface PermissionStoreRepository {
	add(ctx: ServiceCtx, permission: PendingPermission): void;
	get(ctx: ServiceCtx, requestId: string): PendingPermission | undefined;
	listByProcess(ctx: ServiceCtx, processId: string): PendingPermission[];
	listBySession(ctx: ServiceCtx, sessionId: string): PendingPermission[];
	remove(ctx: ServiceCtx, requestId: string): boolean;
	clear(ctx: ServiceCtx): void;
}
