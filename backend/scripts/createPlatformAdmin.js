
import bcrypt from "bcryptjs";
import pool from "../src/config/database.js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });

async function main() {
  try {
    const firstName = (await rl.question("First name: ")).trim();
    const lastName = (await rl.question("Last name (optional): ")).trim();
    const email = (await rl.question("Email: ")).trim().toLowerCase();

    const password = await rl.question(
      "Password (minimum 12 characters; input is visible): "
    );

    if (!firstName || !email || password.length < 12) {
      throw new Error(
        "First name and email are required; password must be at least 12 characters."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.execute(
      `INSERT INTO platform_admins
        (first_name, last_name, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [firstName, lastName || null, email, passwordHash]
    );

    console.log("Platform Admin account created successfully.");
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      console.error("An account with this email already exists.");
    } else {
      console.error("Could not create Platform Admin:", error.message);
    }

    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
