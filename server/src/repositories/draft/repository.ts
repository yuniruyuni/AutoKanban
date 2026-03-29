import type { Draft } from "../../models/common";

export interface IDraftRepository {
	save(sessionId: string, text: string): void;
	get(sessionId: string): Draft | undefined;
	delete(sessionId: string): boolean;
	clear(): void;
}
