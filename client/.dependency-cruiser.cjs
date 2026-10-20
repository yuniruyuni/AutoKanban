/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		// Rule 1: lib/ must not depend on components, pages, hooks, or store
		{
			name: "lib-no-upper-deps",
			comment:
				"lib/ must not depend on components, pages, hooks, or store (pure utilities only)",
			severity: "error",
			from: { path: "^src/lib/", pathNot: "\\.test\\.ts$" },
			to: {
				path: "^src/(components|pages|hooks|store)/",
			},
		},
		// Rule 2: store/ must not depend on components or pages
		{
			name: "store-no-ui-deps",
			comment: "store/ must not depend on components or pages",
			severity: "error",
			from: { path: "^src/store/", pathNot: "\\.test\\.ts$" },
			to: {
				path: "^src/(components|pages)/",
			},
		},
		// Rule 3: No circular dependencies
		{
			name: "no-circular",
			comment: "No circular dependencies allowed",
			severity: "error",
			from: { pathNot: "\\.test\\.ts$" },
			to: {
				circular: true,
			},
		},
	],
	options: {
		doNotFollow: {
			path: "node_modules",
		},
		tsPreCompilationDeps: true,
		// TypeScript 7 (native) ships no JS compiler API, so parse with swc
		// instead of the tsc parser (dependency-cruiser supports typescript <7).
		parser: "swc",
		knownViolations: require("./.dependency-cruiser-known-violations.json"),
	},
};
