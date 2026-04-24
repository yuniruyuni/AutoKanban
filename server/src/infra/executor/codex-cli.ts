import type { ILogger } from "../logger/types";
import type {
	InfraExecutorDriver,
	InfraExecutorProcess,
	InfraExecutorSpawnOptions,
} from "./driver";

export class CodexCliInfraDriver implements InfraExecutorDriver {
	readonly id = "codex-cli";
	readonly defaultCommand = "codex";

	constructor(private readonly logger: ILogger) {}

	spawn(options: InfraExecutorSpawnOptions): InfraExecutorProcess {
		const command = options.command ?? this.defaultCommand;
		const args = buildCodexArgs(options);

		this.logger.info("Spawning Codex CLI", {
			cmd: [command, ...args].join(" "),
			cwd: options.workingDir,
		});

		const proc = Bun.spawn({
			cmd: [command, ...args],
			cwd: options.workingDir,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				CODEX_QUIET_MODE: "1",
				NO_COLOR: "1",
			},
		});

		return {
			proc,
			stdout: proc.stdout,
			stderr: proc.stderr,
		};
	}
}

function buildCodexArgs(options: InfraExecutorSpawnOptions): string[] {
	const args = [
		"exec",
		"--json",
		"--color",
		"never",
		"--cd",
		options.workingDir,
	];

	if (options.model) {
		args.push("--model", options.model);
	}

	switch (options.permissionMode) {
		case "read-only":
			args.push("--sandbox", "read-only");
			break;
		case "dangerously-bypass":
		case "bypassPermissions":
			args.push("--dangerously-bypass-approvals-and-sandbox");
			break;
		default:
			args.push("--full-auto");
			break;
	}

	if (options.resumeToken) {
		args.push("resume", options.resumeToken);
	}

	args.push("-");
	return args;
}
