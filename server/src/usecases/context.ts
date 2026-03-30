import type { PgDatabase } from "../db/pg-client";
import type { ILogStreamer } from "../presentation/log-streamer";
import type {
	DbReadRepos,
	DbWriteRepos,
	FullRepos,
} from "../repositories/common";
import type { ILogger } from "../types/logger";
import type { Repos } from "../repositories";

// ============================================
// Step-specific context types
// ============================================

export type PreContext = { now: Date; logger: ILogger };
export type ReadContext = {
	now: Date;
	logger: ILogger;
	repos: DbReadRepos<Repos>;
};
export type ProcessContext = { now: Date; logger: ILogger };
export type WriteContext = {
	now: Date;
	logger: ILogger;
	repos: DbWriteRepos<Repos>;
};
export type PostContext = {
	now: Date;
	logger: ILogger;
	repos: FullRepos<Repos>;
};

// ============================================
// Full context
// ============================================

export interface Context {
	now: Date;
	logger: ILogger;
	db: PgDatabase;
	rawRepos: Repos;
	repos: FullRepos<Repos>;
	logStreamer: ILogStreamer;
}
