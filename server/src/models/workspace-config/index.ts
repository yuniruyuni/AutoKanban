// @specre 01KPPZWHXZBF4J3P7QB0C67VCP
export interface WorkspaceConfig {
	prepare: string | null;
	server: string | null;
	cleanup: string | null;
}

export namespace WorkspaceConfig {
	export function empty(): WorkspaceConfig {
		return { prepare: null, server: null, cleanup: null };
	}
}
