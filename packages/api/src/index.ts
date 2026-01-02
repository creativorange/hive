import "dotenv/config";
export * from "./server.js";
export * from "./websocket/handler.js";
export * from "./services/evolution-scheduler.js";

import { startServer } from "./server.js";

const port = parseInt(process.env.PORT || "3001", 10);
const host = process.env.HOST || "0.0.0.0";

startServer(port, host);
