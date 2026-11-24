import "dotenv/config";
import pool from "./config/database.js";
import { validateProductionEnvironment } from "./config/production-config.js";
import app from "./app.js";
import { startServer } from "./server-lifecycle.js";

validateProductionEnvironment();
const port = process.env.PORT || 5000;
startServer({ app, pool, port });
console.log(`Recruitment Workflow API listening on port ${port}`);
