import type { ServiceCtx } from "../../types/db-capability";

export interface DevServerRepository {
	start(
		ctx: ServiceCtx,
		options: {
			processId: string;
			command: string;
			workingDir: string;
		},
	): void;
	stop(ctx: ServiceCtx, processId: string): boolean;
	get(ctx: ServiceCtx, processId: string): { pid: number } | undefined;
}
