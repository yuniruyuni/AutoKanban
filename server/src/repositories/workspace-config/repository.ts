import type { WorkspaceConfig } from "../../models/workspace-config";

export interface IWorkspaceConfigRepository {
	load(workingDir: string): Promise<WorkspaceConfig>;
}
