import type { ServiceCtx } from "../common";

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
