// @specre 01KPZT8YMP9F6B9CJFFG809NM0
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type pg from "pg";
import { findFreePort } from "../net/find-free-port";
import { getAutoKanbanHome } from "../paths";

const DEFAULT_USER = "autokanban";
const DEFAULT_PASSWORD = "autokanban";
const DEFAULT_DATABASE = "autokanban";

function killPostgresByPidFile(dataDir: string): void {
	const pidFile = join(dataDir, "postmaster.pid");
	if (!existsSync(pidFile)) return;
	try {
		const pid = Number.parseInt(
			readFileSync(pidFile, "utf-8").split("\n")[0],
			10,
		);
		if (!Number.isNaN(pid)) {
			// SIGINT = PostgreSQL "fast shutdown". Aborts active transactions but
			// writes a checkpoint before exit, so the next startup skips crash
			// recovery. SIGQUIT would skip the checkpoint and force recovery on
			// next boot, which oscillates test/dev startups between fast/slow.
			process.kill(pid, "SIGINT");
		}
	} catch {
		// Process already gone
	}
}

export class EmbeddedPostgresManager {
	private pg: EmbeddedPostgres | null = null;
	private port = 0;
	private user: string;
	private password: string;
	private database: string;
	private dataDir: string;
	private recentLogs: string[] = [];
	private requestedPort: number | undefined;

	constructor(options?: {
		port?: number;
		dataDir?: string;
	}) {
		this.requestedPort = options?.port;
		this.user = DEFAULT_USER;
		this.password = DEFAULT_PASSWORD;
		this.database = DEFAULT_DATABASE;
		this.dataDir = options?.dataDir ?? join(getAutoKanbanHome(), "postgres");
	}

	private dumpLogs(): string {
		return this.recentLogs.join("").trim() || "(no PG log output)";
	}

	async start(): Promise<void> {
		// If an existing PG is running on this data dir, reuse it
		const existingPort = this.getRunningPort();
		if (existingPort) {
			this.port = existingPort;
			this.registerExitHandler();
			return;
		}

		// Clean stale lock if process is dead
		this.cleanStaleLock();

		// Resolve port: use requested port or find a free one
		this.port = this.requestedPort ?? (await findFreePort());

		this.pg = new EmbeddedPostgres({
			databaseDir: this.dataDir,
			port: this.port,
			user: this.user,
			password: this.password,
			persistent: true,
			onLog: (msg) => {
				this.recentLogs.push(msg);
				// Bound memory: keep only the last ~50 log chunks.
				if (this.recentLogs.length > 50) this.recentLogs.shift();
			},
			onError: () => {},
		});

		const alreadyInitialised = existsSync(join(this.dataDir, "PG_VERSION"));
		if (!alreadyInitialised) {
			try {
				await this.pg.initialise();
			} catch (err) {
				throw new Error(
					`Failed to initialise PostgreSQL: ${err ?? this.dumpLogs()}`,
				);
			}
		}

		try {
			await this.pg.start();
		} catch (err) {
			throw new Error(
				`Failed to start PostgreSQL on port ${this.port}: ${err ?? this.dumpLogs()}`,
			);
		}

		this.registerExitHandler();

		await this.pg.createDatabase(this.database).catch(() => {
			// Database already exists — ignore
		});
	}

	private exitHandlerRegistered = false;

	private registerExitHandler(): void {
		if (this.exitHandlerRegistered) return;
		this.exitHandlerRegistered = true;
		const dataDir = this.dataDir;
		process.on("exit", () => {
			killPostgresByPidFile(dataDir);
		});
	}

	async stop(): Promise<void> {
		if (this.pg) {
			await this.pg.stop();
			return;
		}
		this.stopSync();
	}

	/**
	 * Synchronously signal the PostgreSQL process via postmaster.pid.
	 * Safe to call from process "exit" handlers where async is not allowed.
	 */
	stopSync(): void {
		killPostgresByPidFile(this.dataDir);
	}

	get connectionString(): string {
		return `postgresql://${this.user}:${this.password}@localhost:${this.port}/${this.database}`;
	}

	get poolConfig(): pg.PoolConfig {
		return {
			host: "localhost",
			port: this.port,
			user: this.user,
			password: this.password,
			database: this.database,
		};
	}

	get connectionParams(): {
		host: string;
		port: number;
		user: string;
		password: string;
		database: string;
	} {
		return {
			host: "localhost",
			port: this.port,
			user: this.user,
			password: this.password,
			database: this.database,
		};
	}

	/**
	 * Check if a PG process is already running on this data directory.
	 * Returns its port if alive, null otherwise.
	 */
	private getRunningPort(): number | null {
		const pidFile = join(this.dataDir, "postmaster.pid");
		if (!existsSync(pidFile)) return null;

		try {
			const lines = readFileSync(pidFile, "utf-8").split("\n");
			const pid = Number.parseInt(lines[0], 10);
			const port = Number.parseInt(lines[3], 10);
			if (Number.isNaN(pid) || Number.isNaN(port)) return null;

			// Check if PID is alive
			process.kill(pid, 0);
			return port;
		} catch {
			return null;
		}
	}

	/**
	 * Remove stale postmaster.pid if the PID recorded in it is no longer running.
	 */
	private cleanStaleLock(): void {
		const pidFile = join(this.dataDir, "postmaster.pid");
		if (!existsSync(pidFile)) return;

		try {
			const content = readFileSync(pidFile, "utf-8");
			const pid = Number.parseInt(content.split("\n")[0], 10);
			if (Number.isNaN(pid)) {
				rmSync(pidFile);
				return;
			}
			try {
				process.kill(pid, 0);
			} catch {
				rmSync(pidFile);
			}
		} catch {
			try {
				rmSync(pidFile);
			} catch {}
		}
	}
}
