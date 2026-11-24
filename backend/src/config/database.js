
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { createDatabaseConfig } from "./production-config.js";

dotenv.config();

const pool = mysql.createPool(createDatabaseConfig());

export default pool;
