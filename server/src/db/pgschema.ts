import { execSync, spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const PGSCHEMA_VERSION = "1.8.0";
const BIN_DIR = join(homedir(), ".auto-kanban", "bin");

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
	return join(BIN_DIR, "pgschema");
}

async function downloadBinary(): Promise<string> {
	const binaryPath = getBinaryPath();

	if (existsSync(binaryPath)) {
		return binaryPath;
	}

	mkdirSync(BIN_DIR, { recursive: true });

	const url = getDownloadUrl();
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to download pgschema: ${response.status} ${response.statusText}`,
		);
	}

	const buffer = await response.arrayBuffer();
	writeFileSync(binaryPath, Buffer.from(buffer));
	chmodSync(binaryPath, 0o755);

	return binaryPath;
}

export async function ensurePgSchema(
	connectionParams: {
		host: string;
		port: number;
		user: string;
		password: string;
		database: string;
	},
	schemaPath?: string,
): Promise<void> {
	const binaryPath = await downloadBinary();
	const resolvedSchemaPath =
		schemaPath ?? resolve(import.meta.dir, "../../schema.sql");

	const result = spawnSync(
		binaryPath,
		[
			"apply",
			"--host",
			connectionParams.host,
			"--db",
			connectionParams.database,
			"--user",
			connectionParams.user,
			"--schema",
			"public",
			"--file",
			resolvedSchemaPath,
			"--auto-approve",
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
