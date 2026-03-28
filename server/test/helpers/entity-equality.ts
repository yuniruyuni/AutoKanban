import { expect } from "bun:test";

/**
 * Helper for round-trip entity comparison.
 * DB round-trip can introduce small Date precision differences,
 * so Date fields are compared with 1-second tolerance.
 */
export function expectEntityEqual<T extends Record<string, unknown>>(
	actual: T,
	expected: T,
	dateKeys: (keyof T)[] = [],
): void {
	const allKeys = Object.keys(expected) as (keyof T)[];
	for (const key of allKeys) {
		if (dateKeys.includes(key)) {
			const a = actual[key] as Date;
			const b = expected[key] as Date;
			if (a === null && b === null) continue;
			expect(a).toBeInstanceOf(Date);
			expect(b).toBeInstanceOf(Date);
			expect(Math.abs(a.getTime() - b.getTime())).toBeLessThan(1000);
		} else {
			expect(actual[key]).toEqual(expected[key]);
		}
	}
}
