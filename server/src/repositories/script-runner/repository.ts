import type { ServiceCtx } from "../common";

export interface ScriptRunnerResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export interface ScriptRunnerRepository {
	run(
		ctx: ServiceCtx,
		options: {
			command: string;
			workingDir: string;
			timeoutMs?: number;
		},
	): Promise<ScriptRunnerResult>;
}
