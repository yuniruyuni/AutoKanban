/**
 * Schema upgrade smoke test.
 *
 * See docs/specres/architecture/schema_upgrades_must_apply_to_populated_dbs.md
 *
 * Strategy:
 *   1. Extract origin/main's server/schema/ to a temp dir (= "what users have").
 *   2. Start a one-off embedded-postgres in another temp dir.
 *   3. Apply baseline schema.
 *   4. Insert one row per table from server/schema/seeds/<table>.sql.
 *   5. Apply HEAD's server/schema/ — the new pgschema diff runs against a
 *      populated DB. NOT NULL adds without DEFAULT, CHECK additions, etc.
 *      will fail here.
 *
 * If origin/main is not present locally (e.g. fresh clone without `git
 * fetch`), the test prints a warning and exits 0 — CI always has it.
 */
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { applySchema } from "../src/infra/db/pgschema";
import { EmbeddedPostgresManager } from "../src/infra/db/postgres";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const SERVER_DIR = join(REPO_ROOT, "server");
const TABLES_DIR = join(SERVER_DIR, "schema", "tables");
const SEEDS_DIR = join(SERVER_DIR, "schema", "seeds");
const BASELINE_REF = "origin/main";

// Topological order — parents before children.
const SEED_ORDER = [
	"projects",
	"tasks",
	"workspaces",
	"sessions",
	"workspace_repos",
	"coding_agent_processes",
	"coding_agent_process_logs",
	"dev_server_processes",
	"dev_server_process_logs",
	"workspace_script_processes",
	"workspace_script_process_logs",
	"coding_agent_turns",
	"approvals",
	"variants",
	"tools",
	"project_task_templates",
	"agent_settings",
];

function log(msg: string): void {
	console.log(`[check:schema-upgrade] ${msg}`);
}

function fail(msg: string): never {
	console.error(`[check:schema-upgrade] FAIL: ${msg}`);
	process.exit(1);
}

function checkSeedCoverage(): void {
	const tableFiles = readdirSync(TABLES_DIR)
		.filter((f) => f.endsWith(".sql"))
		.map((f) => f.replace(/\.sql$/, ""));
	const seedFiles = existsSync(SEEDS_DIR)
		? readdirSync(SEEDS_DIR)
				.filter((f) => f.endsWith(".sql"))
				.map((f) => f.replace(/\.sql$/, ""))
		: [];

	const missing = tableFiles.filter((t) => !seedFiles.includes(t));
	if (missing.length > 0) {
		fail(
			`tables without a seed SQL: ${missing.join(", ")}\n` +
				`  Add server/schema/seeds/<table>.sql with a minimal INSERT for each.`,
		);
	}

	const orphanSeeds = seedFiles.filter((s) => !tableFiles.includes(s));
	if (orphanSeeds.length > 0) {
		fail(
			`seed SQL with no matching table: ${orphanSeeds.join(", ")}\n` +
				`  Remove or rename to match a table in server/schema/tables/.`,
		);
	}

	const missingFromOrder = tableFiles.filter((t) => !SEED_ORDER.includes(t));
	if (missingFromOrder.length > 0) {
		fail(
			`tables missing from SEED_ORDER in this script: ${missingFromOrder.join(", ")}\n` +
				`  Add them in topological (parents-before-children) order.`,
		);
	}
}

function baselineExists(): boolean {
	const r = spawnSync("git", ["rev-parse", "--verify", BASELINE_REF], {
		cwd: REPO_ROOT,
		stdio: "pipe",
	});
	return r.status === 0;
}

function extractBaseline(into: string): string {
	mkdirSync(into, { recursive: true });
	const r = spawnSync(
		"sh",
		[
			"-c",
			`git archive ${BASELINE_REF} server/schema | tar -x -C ${JSON.stringify(into)}`,
		],
		{ cwd: REPO_ROOT, stdio: "pipe" },
	);
	if (r.status !== 0) {
		const stderr = r.stderr?.toString() ?? "";
		fail(`could not extract ${BASELINE_REF} schema:\n${stderr}`);
	}
	return join(into, "server", "schema");
}

async function runSeeds(poolConfig: pg.PoolConfig): Promise<void> {
	const client = new pg.Client(poolConfig);
	await client.connect();
	try {
		for (const table of SEED_ORDER) {
			const path = join(SEEDS_DIR, `${table}.sql`);
			const sql = readFileSync(path, "utf-8");
			try {
				await client.query(sql);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				fail(
					`seed ${table}.sql failed against baseline schema:\n  ${msg}\n` +
						`  The seed must use only columns that exist in ${BASELINE_REF}.`,
				);
			}
		}
	} finally {
		await client.end();
	}
}

async function main(): Promise<void> {
	checkSeedCoverage();

	if (!baselineExists()) {
		log(
			`${BASELINE_REF} not found locally — skipping (run 'git fetch' to enable).`,
		);
		return;
	}

	const tmp = mkdtempSync(join(tmpdir(), "ak-schema-upgrade-"));
	const baselineRoot = join(tmp, "baseline");
	const pgDataDir = join(tmp, "pg");

	const pgmgr = new EmbeddedPostgresManager({ dataDir: pgDataDir });

	try {
		log(`extracting ${BASELINE_REF}/server/schema → ${baselineRoot}`);
		const baselineSchemaDir = extractBaseline(baselineRoot);

		log("starting one-off embedded-postgres...");
		await pgmgr.start();

		log("applying baseline schema...");
		await applySchema(
			pgmgr.connectionParams,
			join(baselineSchemaDir, "schema.sql"),
		);

		log(`seeding ${SEED_ORDER.length} tables...`);
		await runSeeds(pgmgr.poolConfig);

		log("applying HEAD schema against populated DB...");
		await applySchema(
			pgmgr.connectionParams,
			join(SERVER_DIR, "schema", "schema.sql"),
		);

		log("OK — HEAD schema applies cleanly to a populated baseline DB.");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(
			`[check:schema-upgrade] FAIL: applying HEAD schema to populated baseline DB raised:\n${msg}\n` +
				`\nHints:\n` +
				`  - Adding a NOT NULL column? Give it a DEFAULT.\n` +
				`  - Tightening a constraint? Backfill or relax the constraint.\n` +
				`  - Tightening a column type? Cast or widen first, then narrow in a follow-up.\n`,
		);
		process.exit(1);
	} finally {
		try {
			await pgmgr.stop();
		} catch {}
		try {
			rmSync(tmp, { recursive: true, force: true });
		} catch {}
	}
}

await main();
