import { createContext } from "./context";
import { initDatabase } from "./infra/db";
import { createLogger } from "./infra/logger";
import { startServer, type ServerMode } from "./presentation";

export type { AppRouter } from "./presentation";

async function main() {
	const mode: ServerMode = process.argv.includes("--mcp") ? "mcp" : "main";

	if (mode === "mcp") {
		return startServer({ mode: "mcp" });
	}

	const logger = createLogger();

	logger.info("Starting Auto Kanban server...");
	logger.info("Initializing database...");
	const db = await initDatabase(logger);

	logger.info("Creating application context...");
	const ctx = createContext(db, logger);

	logger.info("Starting server...");
	return startServer({ mode: "main", ctx });
}

export default await main();
