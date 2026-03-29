import EmbeddedPostgres from "embedded-postgres";
import { homedir } from "node:os";
import { join } from "node:path";
import type pg from "pg";

const DEFAULT_PORT = 5445;
const DEFAULT_USER = "autokanban";
const DEFAULT_PASSWORD = "autokanban";
const DEFAULT_DATABASE = "autokanban";

export class EmbeddedPostgresManager {
	private pg: EmbeddedPostgres;
	private port: number;
	private user: string;
	private password: string;
	private database: string;

	constructor(options?: {
		port?: number;
		dataDir?: string;
	}) {
		this.port = options?.port ?? DEFAULT_PORT;
		this.user = DEFAULT_USER;
		this.password = DEFAULT_PASSWORD;
		this.database = DEFAULT_DATABASE;

		const dataDir =
			options?.dataDir ?? join(homedir(), ".auto-kanban", "postgres");

		this.pg = new EmbeddedPostgres({
			databaseDir: dataDir,
			port: this.port,
			user: this.user,
			password: this.password,
			persistent: true,
			onLog: () => {},
			onError: () => {},
		});
	}

	async start(): Promise<void> {
		await this.pg.initialise();
		await this.pg.start();
		await this.pg.createDatabase(this.database).catch(() => {
			// Database already exists — ignore
		});
	}

	async stop(): Promise<void> {
		await this.pg.stop();
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
}
