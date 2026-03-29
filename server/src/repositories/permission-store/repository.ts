import type { PendingPermission } from "../../models/common";

export interface IPermissionStoreRepository {
	add(permission: PendingPermission): void;
	get(requestId: string): PendingPermission | undefined;
	listByProcess(processId: string): PendingPermission[];
	listBySession(sessionId: string): PendingPermission[];
	remove(requestId: string): boolean;
	clear(): void;
}
