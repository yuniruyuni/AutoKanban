// @specre 01KPPZWHXS4NJSCB1ZVD88TRP4
// ============================================
// SQL Builder (Tagged Template Literal)
// ============================================

export interface SQLFragment {
	readonly query: string;
	readonly params: unknown[];
}

export function sql(
	strings: TemplateStringsArray,
	...values: unknown[]
): SQLFragment {
	const queryParts: string[] = [];
	const params: unknown[] = [];

	for (let i = 0; i < strings.length; i++) {
		queryParts.push(strings[i]);

		if (i < values.length) {
			const value = values[i];

			if (isFragment(value)) {
				// Nested fragment - inline query, collect params
				queryParts.push(value.query);
				params.push(...value.params);
			} else {
				// Regular value - placeholder
				queryParts.push("?");
				params.push(value);
			}
		}
	}

	return {
		query: queryParts.join(""),
		params,
	};
}

function isFragment(value: unknown): value is SQLFragment {
	return (
		typeof value === "object" &&
		value !== null &&
		"query" in value &&
		"params" in value
	);
}

// ============================================
// SQL Utilities
// ============================================

export namespace sql {
	export function join(
		fragments: SQLFragment[],
		separator: string,
	): SQLFragment {
		if (fragments.length === 0) {
			return { query: "", params: [] };
		}

		const queries: string[] = [];
		const params: unknown[] = [];

		for (const fragment of fragments) {
			queries.push(fragment.query);
			params.push(...fragment.params);
		}

		return {
			query: queries.join(separator),
			params,
		};
	}

	export function raw(query: string): SQLFragment {
		return { query, params: [] };
	}

	export function list(values: unknown[]): SQLFragment {
		const placeholders = values.map(() => "?").join(", ");
		return {
			query: placeholders,
			params: values,
		};
	}

	export function empty(): SQLFragment {
		return { query: "1=1", params: [] };
	}
}
