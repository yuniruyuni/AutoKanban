import type { Database } from "../infra/db/database";
import type { ILogger } from "../infra/logger/types";
import type { Repos } from "../repositories";
import type {
	DbReadRepos,
	DbWriteRepos,
	FullRepos,
} from "../repositories/common";

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
	db: Database;
	rawRepos: Repos;
	repos: FullRepos<Repos>;
}
