import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.NODE_ENV === "test" && process.env.DATABASE_URL_TEST
    ? process.env.DATABASE_URL_TEST
    : process.env.DATABASE_URL || "postgres://vaibhavsaini@localhost:5432/stockroom";

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
export { schema };

