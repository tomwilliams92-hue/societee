/* Apply Societee's SQL files straight to the Supabase project.
 *
 * Wrapped in a transaction so a failure leaves the database exactly as it was,
 * rather than half-built — which would make the second attempt fail with
 * "already exists" and hide the real error.
 *
 * Usage: node run.mjs <connection-string> [file ...]
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const [conn, ...files] = process.argv.slice(2);
if (!conn || !files.length) {
  console.error("usage: node run.mjs <connection-string> <file.sql> [more.sql]");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

/** Point at the offending line when Postgres gives a character position. */
function context(sql, position) {
  if (!position) return "";
  const upto = sql.slice(0, Number(position));
  const line = upto.split("\n").length;
  const lines = sql.split("\n");
  const from = Math.max(0, line - 4);
  return lines
    .slice(from, line + 2)
    .map((t, i) => `${String(from + i + 1).padStart(4)} ${from + i + 1 === line ? "»" : " "} ${t}`)
    .join("\n");
}

try {
  await client.connect();
  const who = await client.query("select current_database() db, current_user usr, version() v");
  console.log(`connected: ${who.rows[0].db} as ${who.rows[0].usr}`);
  console.log(who.rows[0].v.split(",")[0]);
  console.log();

  for (const file of files) {
    const sql = readFileSync(file, "utf8");
    process.stdout.write(`${file.split("/").pop()} … `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("OK");
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.log("FAILED");
      console.log(`\n  ${e.severity ?? "ERROR"} ${e.code ?? ""}: ${e.message}`);
      if (e.detail) console.log(`  detail: ${e.detail}`);
      if (e.hint) console.log(`  hint:   ${e.hint}`);
      if (e.where) console.log(`  where:  ${e.where.split("\n")[0]}`);
      const ctx = context(sql, e.position);
      if (ctx) console.log(`\n${ctx}\n`);
      console.log("  (rolled back — the database is untouched)");
      process.exitCode = 1;
      break;
    }
  }

  if (!process.exitCode) {
    const t = await client.query(
      "select table_name from information_schema.tables where table_schema='public' order by 1"
    );
    const f = await client.query(
      "select routine_name from information_schema.routines where routine_schema='public' order by 1"
    );
    const c = await client.query("select count(*)::int n from courses").catch(() => ({ rows: [{ n: 0 }] }));
    const te = await client.query("select count(*)::int n from tees").catch(() => ({ rows: [{ n: 0 }] }));
    console.log(`\ntables (${t.rowCount}): ${t.rows.map((r) => r.table_name).join(", ")}`);
    console.log(`functions (${f.rowCount}): ${f.rows.map((r) => r.routine_name).join(", ")}`);
    console.log(`courses: ${c.rows[0].n}, tees: ${te.rows[0].n}`);
  }
} catch (e) {
  console.error("connection failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
