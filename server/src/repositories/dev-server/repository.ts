export interface IDevServerRepository {
	start(options: {
		processId: string;
		command: string;
		workingDir: string;
	}): void;
	stop(processId: string): boolean;
	get(processId: string): { pid: number } | undefined;
}
