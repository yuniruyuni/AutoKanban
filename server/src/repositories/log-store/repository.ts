import type { LogEntry, LogStoreSubscription } from "../../models/log-store";
import type { ServiceCtx } from "../common";

export interface LogStore {
	append(ctx: ServiceCtx, entry: LogEntry): void;
	close(ctx: ServiceCtx): void;
	isClosed(ctx: ServiceCtx): boolean;
	getHistory(ctx: ServiceCtx): LogEntry[];
	subscribe(ctx: ServiceCtx): LogStoreSubscription;
}

export interface LogStoreManager {
	create(ctx: ServiceCtx, processId: string): LogStore;
	get(ctx: ServiceCtx, processId: string): LogStore | undefined;
	close(ctx: ServiceCtx, processId: string): void;
}
