import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.resolve(".env") });

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, "..");
const sourceName = process.env.DB_NAME;
if (!process.env.DB_HOST || !sourceName || !process.env.DB_USER) {
  throw new Error("DB_HOST, DB_NAME, and DB_USER are required for schema-only cloning");
}

const targetName = `recruitment_workflow_test_${process.pid}_${randomBytes(4).toString("hex")}`;
if (targetName === sourceName || !targetName.startsWith("recruitment_workflow_test_")) {
  throw new Error("Refusing to use a non-test database name");
}
const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectTimeout: 10000,
};
let created = false;
let admin;
let exitCode = 1;

try {
  admin = await mysql.createConnection(config);
  const [dbRows] = await admin.execute(
    `SELECT DEFAULT_CHARACTER_SET_NAME AS charset_name, DEFAULT_COLLATION_NAME AS collation_name
     FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
    [sourceName],
  );
  if (!dbRows[0]) throw new Error("Configured source schema is not visible to this account");
  const [tableRows] = await admin.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    [sourceName],
  );
  if (!tableRows.length) throw new Error("Source schema contains no base tables");
  const [keyRows] = await admin.execute(
    `SELECT TABLE_NAME, REFERENCED_TABLE_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [sourceName],
  );
  const tables = tableRows.map((row) => row.TABLE_NAME);
  const dependencies = new Map(tables.map((table) => [table, new Set()]));
  for (const row of keyRows) {
    if (dependencies.has(row.TABLE_NAME) && dependencies.has(row.REFERENCED_TABLE_NAME)) {
      dependencies.get(row.TABLE_NAME).add(row.REFERENCED_TABLE_NAME);
    }
  }
  const ordered = [];
  const remaining = new Set(tables);
  while (remaining.size) {
    const ready = [...remaining].filter((table) => [...dependencies.get(table)].every((dep) => !remaining.has(dep)));
    if (!ready.length) throw new Error("Schema has cyclic table dependencies; refusing partial clone");
    for (const table of ready) { ordered.push(table); remaining.delete(table); }
  }

  const quotedName = `\`${targetName}\``;
  await admin.query(`CREATE DATABASE ${quotedName} CHARACTER SET ${dbRows[0].charset_name} COLLATE ${dbRows[0].collation_name}`);
  created = true;
  const clone = await mysql.createConnection({ ...config, database: targetName, multipleStatements: false });
  try {
    for (const table of ordered) {
      const escapedTable = table.replace(/`/g, "``");
      const [definition] = await admin.query(`SHOW CREATE TABLE \`${sourceName.replace(/`/g, "``")}\`.\`${escapedTable}\``);
      await clone.query(definition[0]["Create Table"]);
    }
    const migrationsDir = path.join(backendDir, "migrations");
    const migrationFiles = (await readdir(migrationsDir)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
    for (const migrationFile of migrationFiles) {
      const contents = await readFile(path.join(migrationsDir, migrationFile), "utf8");
      for (const statement of contents.split(";").map((sql) => sql.trim()).filter(Boolean)) {
        await clone.query(statement);
      }
    }
  } finally {
    await clone.end();
  }

  const testFiles = (await readdir(path.join(backendDir, "test", "mysql-integration")))
    .filter((name) => name.endsWith(".test.js"))
    .map((name) => path.join("test", "mysql-integration", name));
  if (!testFiles.length) throw new Error("No MySQL integration test files found");
  process.stdout.write(`Created empty schema clone ${targetName} (${tables.length} tables); no source rows copied.\n`);
  const result = spawnSync(process.execPath, ["--test", ...testFiles], {
    cwd: backendDir,
    env: { ...process.env, DB_NAME: targetName, RECRUITMENT_TEST_DATABASE: "1", JWT_SECRET: randomBytes(32).toString("hex") },
    stdio: "inherit",
  });
  exitCode = result.status ?? 1;
} catch (error) {
  process.stderr.write(`MySQL integration setup/test failed: ${error.code || error.message}\n`);
  exitCode = 1;
} finally {
  if (created && admin) {
    try {
      await admin.query(`DROP DATABASE \`${targetName}\``);
      process.stdout.write(`Dropped temporary test database ${targetName}.\n`);
    } catch (error) {
      process.stderr.write(`Cleanup failed for temporary database ${targetName}: ${error.code || error.message}\n`);
      exitCode = 1;
    }
  }
  if (admin) await admin.end();
}
process.exitCode = exitCode;
