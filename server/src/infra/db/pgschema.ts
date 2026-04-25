import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAutoKanbanHome } from "../paths";
import { extractSchema } from "./schema-vfs";

const PGSCHEMA_VERSION = "1.8.0";
function getBinDir(): string {
	return join(getAutoKanbanHome(), "bin");
}

function getPlatformBinary(): string {
	const platform = process.platform;
	const arch = process.arch;

	let os: string;
	if (platform === "darwin") {
		os = "darwin";
	} else if (platform === "linux") {
		os = "linux";
	} else {
		throw new Error(`Unsupported platform: ${platform}`);
	}

	let cpu: string;
	if (arch === "arm64") {
		cpu = "arm64";
	} else if (arch === "x64") {
		cpu = "amd64";
	} else {
		throw new Error(`Unsupported architecture: ${arch}`);
	}

	return `pgschema-${PGSCHEMA_VERSION}-${os}-${cpu}`;
}

function getDownloadUrl(): string {
	const binaryName = getPlatformBinary();
	return `https://github.com/pgplex/pgschema/releases/download/v${PGSCHEMA_VERSION}/${binaryName}`;
}

function getBinaryPath(): string {
	return join(getBinDir(), "pgschema");
}

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60_000;
const DOWNLOAD_RETRIES = 1;

function getDownloadTimeoutMs(): number {
	const raw = process.env.AUTO_KANBAN_PGSCHEMA_TIMEOUT_MS;
	if (!raw) return DEFAULT_DOWNLOAD_TIMEOUT_MS;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : DEFAULT_DOWNLOAD_TIMEOUT_MS;
}

async function fetchBinary(
	url: string,
	timeoutMs: number,
): Promise<ArrayBuffer> {
	let lastErr: unknown;
	for (let attempt = 0; attempt <= DOWNLOAD_RETRIES; attempt++) {
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(timeoutMs),
			});
			if (!response.ok) {
				throw new Error(
					`Failed to download pgschema: ${response.status} ${response.statusText}`,
				);
			}
			return await response.arrayBuffer();
		} catch (err) {
			lastErr = err;
			const isTimeout = err instanceof Error && err.name === "TimeoutError";
			if (attempt < DOWNLOAD_RETRIES) {
				continue;
			}
			const reason = isTimeout
				? `timed out after ${timeoutMs / 1000}s`
				: err instanceof Error
					? err.message
					: String(err);
			throw new Error(
				`Failed to download pgschema from ${url} (${reason}). ` +
					"Check your network connection and restart Auto Kanban to retry.",
				{ cause: lastErr instanceof Error ? lastErr : undefined },
			);
		}
	}
	// unreachable
	throw lastErr instanceof Error ? lastErr : new Error("download failed");
}

async function downloadBinary(): Promise<string> {
	const binaryPath = getBinaryPath();

	if (existsSync(binaryPath)) {
		return binaryPath;
	}

	mkdirSync(getBinDir(), { recursive: true });

	const url = getDownloadUrl();
	const buffer = await fetchBinary(url, getDownloadTimeoutMs());
	writeFileSync(binaryPath, Buffer.from(buffer));
	chmodSync(binaryPath, 0o755);

	return binaryPath;
}

export interface PgConnectionParams {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
}

export async function applySchema(
	connectionParams: PgConnectionParams,
	schemaFilePath: string,
): Promise<void> {
	const binaryPath = await downloadBinary();

	const result = spawnSync(
		binaryPath,
		[
			"apply",
			"--host",
			connectionParams.host,
			"--port",
			connectionParams.port.toString(),
			"--db",
			connectionParams.database,
			"--user",
			connectionParams.user,
			"--schema",
			"public",
			"--file",
			schemaFilePath,
			"--auto-approve",
			// Use the same postgres instance for plan validation
			// to avoid starting a second embedded postgres (which can
			// fail on macOS due to limited SysV shared memory).
			"--plan-host",
			connectionParams.host,
			"--plan-port",
			connectionParams.port.toString(),
			"--plan-db",
			connectionParams.database,
			"--plan-user",
			connectionParams.user,
			"--plan-password",
			connectionParams.password,
		],
		{
			env: {
				...process.env,
				PGPASSWORD: connectionParams.password,
			},
			stdio: "pipe",
		},
	);

	if (result.status !== 0) {
		const stderr = result.stderr?.toString() ?? "";
		const stdout = result.stdout?.toString() ?? "";
		throw new Error(
			`pgschema apply failed (exit ${result.status}):\n${stderr}\n${stdout}`,
		);
	}
}

// @specre 01KQ2EWC7XPARS1RBHKVW2FNV3
export async function ensurePgSchema(
	connectionParams: PgConnectionParams,
): Promise<void> {
	const schemaDir = extractSchema();
	try {
		await applySchema(connectionParams, join(schemaDir.path, "schema.sql"));
	} finally {
		schemaDir.cleanup();
	}
}
