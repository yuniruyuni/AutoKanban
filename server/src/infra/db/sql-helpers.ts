import type { Comp } from "../../models/common";
import { isCompLogical } from "../../models/common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Comp to SQL converter
// ============================================

export function compToSQL<T>(
	spec: Comp<T>,
	convert: (s: T) => SQLFragment,
): SQLFragment {
	if (isCompLogical(spec)) {
		switch (spec.type) {
			case "and": {
				if (spec.children.length === 0) {
					return sql.empty();
				}
				const fragments = spec.children.map((c) => compToSQL(c, convert));
				const joined = sql.join(fragments, " AND ");
				return sql`(${joined})`;
			}
			case "or": {
				if (spec.children.length === 0) {
					return sql`1=0`; // OR of nothing is false
				}
				const fragments = spec.children.map((c) => compToSQL(c, convert));
				const joined = sql.join(fragments, " OR ");
				return sql`(${joined})`;
			}
			case "not": {
				const child = compToSQL(spec.child, convert);
				return sql`NOT (${child})`;
			}
		}
	}

	return convert(spec as T);
}

// ============================================
// Row to Entity converters
// ============================================

export function dateFromSQL(value: string | Date): Date {
	return new Date(value);
}

export function dateToSQL(value: Date): string {
	return value.toISOString();
}
