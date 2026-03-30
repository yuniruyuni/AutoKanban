import type { ILogger } from "../../src/lib/logger/types";

export interface LogEntry {
	level: "debug" | "info" | "warn" | "error";
	message: string;
	args: unknown[];
}

export class MockLogger implements ILogger {
	readonly entries: LogEntry[] = [];
	readonly children = new Map<string, MockLogger>();

	debug(message: string, ...args: unknown[]): void {
		this.entries.push({ level: "debug", message, args });
	}

	info(message: string, ...args: unknown[]): void {
		this.entries.push({ level: "info", message, args });
	}

	warn(message: string, ...args: unknown[]): void {
		this.entries.push({ level: "warn", message, args });
	}

	error(message: string, ...args: unknown[]): void {
		this.entries.push({ level: "error", message, args });
	}

	child(prefix: string): ILogger {
		const child = new MockLogger();
		this.children.set(prefix, child);
		return child;
	}

	hasError(pattern?: string | RegExp): boolean {
		return this.has("error", pattern);
	}

	hasInfo(pattern?: string | RegExp): boolean {
		return this.has("info", pattern);
	}

	hasWarn(pattern?: string | RegExp): boolean {
		return this.has("warn", pattern);
	}

	private has(level: LogEntry["level"], pattern?: string | RegExp): boolean {
		const filtered = this.entries.filter((e) => e.level === level);
		if (!pattern) return filtered.length > 0;

		return filtered.some((e) =>
			typeof pattern === "string"
				? e.message.includes(pattern)
				: pattern.test(e.message),
		);
	}
}

export function createMockLogger(): MockLogger {
	return new MockLogger();
}
