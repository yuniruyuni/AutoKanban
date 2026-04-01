export type { AppRouter } from "./presentation";

async function main() {
	if (process.argv.includes("--mcp")) {
		const { runMcpServer } = await import("./presentation/mcp/stdio");
		return runMcpServer();
	}

	// Only import heavy dependencies for main HTTP mode
	const { createLogger } = await import("./infra/logger");
	const { initDatabase } = await import("./infra/db");
	const { createContext } = await import("./context");
	const { startServer } = await import("./presentation");

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
