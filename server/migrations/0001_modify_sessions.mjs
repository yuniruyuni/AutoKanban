// Automatically created by 'sqlite auto migrator (SAM)' on 2026-03-02T05:37:46.356Z

import { Database } from "sqlite-auto-migrator";

// Pragmas can't be changed in transactions, so they are tracked separately.
// Note that most pragmas are not persisted in the database file and will have to be set on each new connection.
export const PRAGMAS = {
	analysis_limit: 0,
	application_id: 0,
	auto_vacuum: 0,
	automatic_index: 1,
	timeout: 0,
	cache_size: 2000,
	cache_spill: 20000,
	cell_size_check: 0,
	checkpoint_fullfsync: 1,
	seq: 0,
	name: "tools",
	compile_options: "ATOMIC_INTRINSICS=1",
	count_changes: 0,
	data_version: 1,
	file: "/private/var/folders/h7/_zhk66ds6q5ghs4f0l77ntjh0000gn/T/Z9UG6I/temp.db",
	defer_foreign_keys: 0,
	empty_result_callbacks: 0,
	encoding: "UTF-8",
	foreign_keys: 0,
	freelist_count: 0,
	full_column_names: 0,
	fullfsync: 0,
	builtin: 1,
	type: "table",
	enc: "utf8",
	narg: 2,
	flags: 2099200,
	hard_heap_limit: 0,
	ignore_check_constraints: 0,
	integrity_check: "ok",
	journal_mode: "delete",
	journal_size_limit: 32768,
	legacy_alter_table: 1,
	locking_mode: "normal",
	max_page_count: 1073741823,
	mmap_size: 0,
	page_count: 26,
	page_size: 4096,
	query_only: 0,
	quick_check: "ok",
	read_uncommitted: 0,
	recursive_triggers: 0,
	reverse_unordered_selects: 0,
	schema_version: 13,
	secure_delete: 2,
	short_column_names: 1,
	soft_heap_limit: 0,
	synchronous: 2,
	schema: "main",
	ncol: 8,
	wr: 0,
	strict: 0,
	temp_store: 0,
	threads: 0,
	trusted_schema: 1,
	user_version: 0,
	wal_autocheckpoint: 1000,
	busy: 0,
	log: -1,
	checkpointed: -1,
	writable_schema: 0,
};

/**
 * Runs the necessary SQL commands to migrate the database up to this version from the previous version.
 * Automatically runs in a transaction with deferred foreign keys.
 * @param {Database} db database instance to run SQL commands on
 */
export async function up(db) {
	await db.run('ALTER TABLE "sessions" ADD COLUMN "variant" TEXT');
}

/**
 * Runs the necessary SQL commands to migrate the database down to the previous version from this version.
 * Automatically runs in a transaction with deferred foreign keys.
 * @param {Database} db database instance to run SQL commands on
 */
export async function down(db) {
	await db.run('ALTER TABLE "sessions" DROP COLUMN "variant"');
}
