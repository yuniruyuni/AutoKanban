/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		// Rule 1: Model depends on nothing else
		{
			name: "model-no-upper-layer-deps",
			comment:
				"Models must not depend on repositories, usecases, or presentation",
			severity: "error",
			from: { path: "^src/models/", pathNot: "\\.test\\.ts$" },
			to: {
				path: "^src/(repositories|usecases|presentation)/",
			},
		},
		// Rule 2: Repository must not depend on upper layers
		{
			name: "repository-no-upper-layer-deps",
			comment: "Repositories must not depend on usecases or presentation",
			severity: "error",
			from: { path: "^src/repositories/", pathNot: "\\.test\\.ts$" },
			to: {
				path: "^src/(usecases|presentation)/",
			},
		},
		// Rule 3: Usecase must not directly import repository
		{
			name: "usecase-no-direct-repository-import",
			comment:
				"Usecases must access repositories through context, not direct imports",
			severity: "error",
			from: { path: "^src/usecases/", pathNot: "\\.test\\.ts$" },
			to: {
				path: "^src/repositories/",
			},
		},
		// Rule 4: Usecase must not depend on presentation
		{
			name: "usecase-no-presentation-deps",
			comment: "Usecases must not depend on presentation layer",
			severity: "error",
			from: { path: "^src/usecases/", pathNot: "\\.test\\.ts$" },
			to: {
				path: "^src/presentation/",
			},
		},
		// Rule 5: Usecase files must not import other usecase files
		//   - index.ts (barrel re-exports) and runner.ts are excluded from both sides
		{
			name: "usecase-no-cross-usecase-deps",
			comment:
				"Individual usecase files must not import other usecases (except via runner.ts or barrel index.ts)",
			severity: "error",
			from: {
				path: "^src/usecases/",
				pathNot:
					"(^src/usecases/(index|runner)\\.ts$|/index\\.ts$|\\.test\\.ts$)",
			},
			to: {
				path: "^src/usecases/",
				pathNot: "(^src/usecases/(index|runner)\\.ts$|/index\\.ts$)",
			},
		},
		// Rule 6: Presentation must not directly import repository
		{
			name: "presentation-no-direct-repository-import",
			comment: "Presentation must not directly import repositories",
			severity: "error",
			from: { path: "^src/presentation/", pathNot: "\\.test\\.ts$" },
			to: {
				path: "^src/repositories/",
			},
		},
		// Rule 7: No circular dependencies
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
		knownViolations: require("./.dependency-cruiser-known-violations.json"),
	},
};
