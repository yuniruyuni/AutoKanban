import pg, { type QueryResultRow } from "pg";
import type { SQLFragment } from "../repositories/sql";

export class PgDatabase {
	private pool: pg.Pool;

	constructor(config: pg.PoolConfig) {
		this.pool = new pg.Pool(config);
	}

	async queryGet<T extends QueryResultRow>(
		fragment: SQLFragment,
	): Promise<T | null> {
		const { query, params } = finalize(fragment);
		const result = await this.pool.query<T>(query, params);
		return result.rows[0] ?? null;
	}

	async queryAll<T extends QueryResultRow>(
		fragment: SQLFragment,
	): Promise<T[]> {
		const { query, params } = finalize(fragment);
		const result = await this.pool.query<T>(query, params);
		return result.rows;
	}

	async queryRun(fragment: SQLFragment): Promise<{ rowCount: number }> {
		const { query, params } = finalize(fragment);
		const result = await this.pool.query(query, params);
		return { rowCount: result.rowCount ?? 0 };
	}

	async close(): Promise<void> {
		await this.pool.end();
	}
}

/**
 * Convert `?` placeholders to PostgreSQL `$1, $2, ...` numbered placeholders.
 * This allows the sql tagged template builder to remain unchanged.
 */
export function finalize(fragment: SQLFragment): {
	query: string;
	params: unknown[];
} {
	let index = 0;
	const query = fragment.query.replace(/\?/g, () => {
		index++;
		return `$${index}`;
	});
	return { query, params: fragment.params };
}
