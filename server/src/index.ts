import { createContext } from "./context";
import { initDatabase } from "./infra/db";
import { createLogger } from "./infra/logger";
import { startServer } from "./presentation";

const logger = createLogger();

logger.info("Starting Auto Kanban server...");
logger.info("Initializing database...");
const db = await initDatabase(logger);

logger.info("Creating application context...");
const ctx = createContext(db, logger);

logger.info("Starting server...");
export default await startServer(ctx);

export type { AppRouter } from "./presentation";
