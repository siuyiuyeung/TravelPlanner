import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

console.log("Running migrations...");
migrate(db, { migrationsFolder: "./drizzle" })
  .then(() => {
    console.log("Migrations applied successfully.");
    pool.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    pool.end();
    process.exit(1);
  });
