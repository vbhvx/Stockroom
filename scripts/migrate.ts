import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || "postgres://vaibhavsaini@localhost:5432/stockroom";
  console.log(`Connecting to database at ${connectionString}...`);

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const migrationsDir = path.join(__dirname, "../src/db/migrations");
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

    for (const file of files) {
      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`Successfully applied ${file}`);
    }

    console.log("All migrations applied successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();

