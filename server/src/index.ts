import { createContext } from "./context";
import { initDatabase } from "./lib/db";
import { createLogger } from "./lib/logger";
import { startServer } from "./presentation";

const logger = createLogger();
const db = await initDatabase();
const ctx = createContext(db, logger);

export default await startServer(ctx);

export type { AppRouter } from "./presentation";
