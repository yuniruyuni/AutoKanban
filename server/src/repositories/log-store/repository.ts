import type { LogEntry, LogStoreSubscription } from "../../models/common";

export interface ILogStore {
	append(entry: LogEntry): void;
	close(): void;
	isClosed(): boolean;
	getHistory(): LogEntry[];
	subscribe(): LogStoreSubscription;
}

export interface ILogStoreManager {
	create(processId: string): ILogStore;
	get(processId: string): ILogStore | undefined;
	close(processId: string): void;
}
