/**
 * Applies SQL files under supabase/migrations to the configured Supabase
 * project, in filename order. Uses the service-role key.
 *
 * Supabase REST does not expose raw SQL execution; this script uses the
 * Postgres connection details via the `pg` package if available, otherwise
 * prints the SQL so the operator can paste it into the Supabase SQL editor.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../server/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

console.log(`Found ${files.length} migration file(s) in ${migrationsDir}`);
console.log("");
console.log("Supabase JS does not support raw DDL execution. To apply migrations,");
console.log("copy the SQL below and run it in the Supabase Dashboard SQL editor:");
console.log("");
console.log("  " + config.supabase.url.replace("https://", "https://supabase.com/dashboard/project/").replace(/\.supabase\.co.*$/, ""));
console.log("  → SQL Editor → New query → paste → Run");
console.log("");
console.log("─".repeat(70));
for (const f of files) {
  console.log(`\n-- File: ${f}`);
  console.log(fs.readFileSync(path.join(migrationsDir, f), "utf8"));
}
console.log("─".repeat(70));
