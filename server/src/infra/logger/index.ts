import type { ILogger } from "./types";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

export type LogOutput = "stdout" | "stderr";

interface ConsoleLoggerOptions {
	prefix?: string;
	minLevel?: LogLevel;
	output?: LogOutput;
}

export class ConsoleLogger implements ILogger {
	private readonly prefix: string;
	private readonly minLevel: LogLevel;
	private readonly output: LogOutput;

	constructor(options: ConsoleLoggerOptions = {}) {
		this.prefix = options.prefix ?? "";
		this.minLevel = options.minLevel ?? "info";
		this.output = options.output ?? "stdout";
	}

	debug(message: string, ...args: unknown[]): void {
		this.log("debug", message, args);
	}

	info(message: string, ...args: unknown[]): void {
		this.log("info", message, args);
	}

	warn(message: string, ...args: unknown[]): void {
		this.log("warn", message, args);
	}

	error(message: string, ...args: unknown[]): void {
		this.log("error", message, args);
	}

	child(prefix: string): ILogger {
		const newPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
		return new ConsoleLogger({ ...this.options(), prefix: newPrefix });
	}

	private options(): ConsoleLoggerOptions {
		return {
			prefix: this.prefix,
			minLevel: this.minLevel,
			output: this.output,
		};
	}

	private log(level: LogLevel, message: string, args: unknown[]): void {
		if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

		const formatted = this.prefix ? `[${this.prefix}] ${message}` : message;

		if (this.output === "stderr") {
			console.error(formatted, ...args);
			return;
		}

		switch (level) {
			case "debug":
				console.debug(formatted, ...args);
				break;
			case "info":
				console.log(formatted, ...args);
				break;
			case "warn":
				console.warn(formatted, ...args);
				break;
			case "error":
				console.error(formatted, ...args);
				break;
		}
	}
}

export interface CreateLoggerOptions {
	level?: LogLevel;
	output?: LogOutput;
}

export function createLogger(options?: CreateLoggerOptions): ILogger {
	return new ConsoleLogger({
		minLevel: options?.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info",
		output: options?.output,
	});
}
