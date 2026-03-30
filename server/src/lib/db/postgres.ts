import { createServer } from "node:net";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type pg from "pg";

const DEFAULT_USER = "autokanban";
const DEFAULT_PASSWORD = "autokanban";
const DEFAULT_DATABASE = "autokanban";

/**
 * Find a free TCP port by binding to port 0 and releasing.
 */
function findFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, () => {
			const addr = server.address();
			if (typeof addr === "object" && addr) {
				const port = addr.port;
				server.close(() => resolve(port));
			} else {
				server.close(() => reject(new Error("Failed to get port")));
			}
		});
		server.on("error", reject);
	});
}

export class EmbeddedPostgresManager {
	private pg: EmbeddedPostgres | null = null;
	private port = 0;
	private user: string;
	private password: string;
	private database: string;
	private dataDir: string;
	private lastLog = "";
	private requestedPort: number | undefined;

	constructor(options?: {
		port?: number;
		dataDir?: string;
	}) {
		this.requestedPort = options?.port;
		this.user = DEFAULT_USER;
		this.password = DEFAULT_PASSWORD;
		this.database = DEFAULT_DATABASE;
		this.dataDir =
			options?.dataDir ?? join(homedir(), ".auto-kanban", "postgres");
	}

	async start(): Promise<void> {
		// If an existing PG is running on this data dir, reuse it
		const existingPort = this.getRunningPort();
		if (existingPort) {
			this.port = existingPort;
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
				this.lastLog = msg;
			},
			onError: () => {},
		});

		const alreadyInitialised = existsSync(join(this.dataDir, "PG_VERSION"));
		if (!alreadyInitialised) {
			try {
				await this.pg.initialise();
			} catch (err) {
				throw new Error(
					`Failed to initialise PostgreSQL: ${err ?? this.lastLog}`,
				);
			}
		}

		try {
			await this.pg.start();
		} catch (err) {
			throw new Error(
				`Failed to start PostgreSQL on port ${this.port}: ${err ?? this.lastLog}`,
			);
		}

		await this.pg.createDatabase(this.database).catch(() => {
			// Database already exists — ignore
		});
	}

	async stop(): Promise<void> {
		await this.pg?.stop();
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
