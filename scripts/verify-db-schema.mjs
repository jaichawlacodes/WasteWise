/**
 * Phase 1 — Schema verification (READ-ONLY).
 *
 * Verifies the TARGET (Supabase) database against the existing Drizzle schema
 * (utils/db/schema.ts / drizzle/0000_shiny_venom.sql).
 *
 * SAFETY:
 *  - Refuses to run unless the URL host is a supabase.co / pooler.supabase.com host.
 *  - Only SELECT introspection queries. No writes, no destructive commands.
 *  - Never prints the connection string or credentials.
 *
 * Usage: npm run verify:db
 */
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: "./.env" });

const url = process.env.TARGET_DATABASE_URL;
if (!url) {
  console.error("FAIL (abort): TARGET_DATABASE_URL is not set.");
  process.exit(2);
}

const hostMatch = url.match(/@([^:/@]+)/);
const host = hostMatch ? hostMatch[1] : "";
if (!/(supabase\.co|pooler\.supabase\.com)$/.test(host)) {
  console.error(`FAIL (abort): TARGET_DATABASE_URL host '${host}' is NOT a Supabase host. Refusing to run.`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Expected schema (from utils/db/schema.ts)
// ---------------------------------------------------------------------------
const EXPECTED_TABLES = {
  users: {
    id: { type: "integer", nullable: false, serial: true },
    email: { type: "character varying", len: 255, nullable: true },
    name: { type: "character varying", len: 255, nullable: true },
    created_at: { type: "timestamp without time zone", nullable: true, default: "now" },
  },
  reports: {
    id: { type: "integer", nullable: false, serial: true },
    user_id: { type: "integer", nullable: true },
    location: { type: "text", nullable: true },
    waste_type: { type: "character varying", len: 255, nullable: true },
    amount: { type: "character varying", len: 255, nullable: true },
    image_url: { type: "text", nullable: true },
    verification_result: { type: "jsonb", nullable: true },
    status: { type: "character varying", len: 255, nullable: true, default: "'pending'" },
    created_at: { type: "timestamp without time zone", nullable: true, default: "now" },
    collector_id: { type: "integer", nullable: true },
  },
  rewards: {
    id: { type: "integer", nullable: false, serial: true },
    user_id: { type: "integer", nullable: true },
    points: { type: "integer", nullable: true, default: "0" },
    level: { type: "integer", nullable: true, default: "1" },
    created_at: { type: "timestamp without time zone", nullable: true, default: "now" },
    updated_at: { type: "timestamp without time zone", nullable: true, default: "now" },
    is_available: { type: "boolean", nullable: true, default: "true" },
    description: { type: "text", nullable: true },
    name: { type: "character varying", len: 255, nullable: true },
    collection_info: { type: "text", nullable: true },
  },
  collected_wastes: {
    id: { type: "integer", nullable: false, serial: true },
    report_id: { type: "integer", nullable: true },
    collector_id: { type: "integer", nullable: true },
    collection_date: { type: "timestamp without time zone", nullable: true },
    status: { type: "character varying", len: 20, nullable: true, default: "'collected'" },
  },
  notifications: {
    id: { type: "integer", nullable: false, serial: true },
    user_id: { type: "integer", nullable: true },
    message: { type: "text", nullable: true },
    type: { type: "character varying", len: 50, nullable: true },
    is_read: { type: "boolean", nullable: true, default: "false" },
    created_at: { type: "timestamp without time zone", nullable: true, default: "now" },
  },
  transactions: {
    id: { type: "integer", nullable: false, serial: true },
    user_id: { type: "integer", nullable: true },
    type: { type: "character varying", len: 20, nullable: true },
    amount: { type: "integer", nullable: true },
    description: { type: "text", nullable: true },
    date: { type: "timestamp without time zone", nullable: true, default: "now" },
  },
};

const EXPECTED_FKS = {
  collected_wastes: { report_id: "reports", collector_id: "users" },
  notifications: { user_id: "users" },
  reports: { user_id: "users", collector_id: "users" },
  rewards: { user_id: "users" },
  transactions: { user_id: "users" },
};

const EXPECTED_NUM_TABLES = 6;
const EXPECTED_NUM_FKS = 7;

// ---------------------------------------------------------------------------
// Results collector
// ---------------------------------------------------------------------------
const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
};

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  // ----- Introspection queries (read-only) -----
  const tables = await sql`
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
  `;

  const columns = await sql`
    SELECT c.table_name, c.column_name, c.data_type, c.is_nullable,
           c.character_maximum_length, c.column_default, c.is_identity, c.udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position;
  `;

  // Scope to the 'public' schema only (excludes Supabase platform schemas: auth, storage, realtime, ...)
  const fks = await sql`
    SELECT c.conrelid::regclass AS tbl,
           a.attname AS col,
           c.confrelid::regclass AS ref,
           c.confdeltype AS del,
           c.confupdtype AS upd
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)
    ORDER BY 1, 2;
  `;

  // Real CHECK constraints on public tables via pg_constraint.
  // NOTE: information_schema.table_constraints also lists synthetic '<oid>_<attnum>_not_null'
  // entries for every NOT NULL column (standard PG 12+ behavior) — those are NOT stored
  // constraints, so we compare against pg_constraint where they do not exist.
  const checkConstraints = await sql`
    SELECT conrelid::regclass AS tbl,
           conname,
           pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)
    ORDER BY 1, 2;
  `;

  const constraints = await sql`
    SELECT tc.table_name, tc.constraint_type, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_type;
  `;

  const indexes = await sql`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `;

  const enums = await sql`
    SELECT t.typname
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e';
  `;

  const views = await sql`
    SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;
  `;

  const sequences = await sql`
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename;
  `;

  const rls = await sql`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
      AND relrowsecurity = true;
  `;

  const triggers = await sql`
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = 'public';
  `;

  // Row counts to prove no data migrated
  const counts = {};
  for (const t of Object.keys(EXPECTED_TABLES)) {
    const [{ n }] = await sql.unsafe(`SELECT COUNT(*) AS n FROM "public"."${t}"`);
    counts[t] = Number(n);
  }

  // ----- 1. Tables exist, exactly 6, no extras -----
  const actualTables = tables.map((t) => t.table_name).sort();
  const expectedTableNames = Object.keys(EXPECTED_TABLES).sort();
  check("T1", `Exactly ${EXPECTED_NUM_TABLES} expected tables (users, reports, rewards, collected_wastes, notifications, transactions)`,
    actualTables.length === EXPECTED_NUM_TABLES && JSON.stringify(actualTables) === JSON.stringify(expectedTableNames),
    `found: ${actualTables.join(", ") || "(none)"}`);

  const colsByTable = {};
  for (const c of columns) (colsByTable[c.table_name] = colsByTable[c.table_name] || []).push(c);

  // ----- 2. Columns, types, nullability -----
  let allColumnsOk = true;
  const mismatchDetail = [];
  for (const [tbl, defs] of Object.entries(EXPECTED_TABLES)) {
    const actual = (colsByTable[tbl] || []).reduce((m, c) => {
      m[c.column_name] = c;
      return m;
    }, {});
    for (const [col, exp] of Object.entries(defs)) {
      const a = actual[col];
      if (!a) { allColumnsOk = false; mismatchDetail.push(`${tbl}.${col} MISSING`); continue; }
      if (a.data_type !== exp.type) { allColumnsOk = false; mismatchDetail.push(`${tbl}.${col} type ${a.data_type} != ${exp.type}`); }
      if (exp.len && a.character_maximum_length !== exp.len) { allColumnsOk = false; mismatchDetail.push(`${tbl}.${col} len ${a.character_maximum_length} != ${exp.len}`); }
      const nullable = a.is_nullable === "YES";
      if (nullable !== exp.nullable) { allColumnsOk = false; mismatchDetail.push(`${tbl}.${col} nullable=${nullable} != ${exp.nullable}`); }
    }
    // reject extra columns
    for (const col of Object.keys(actual)) {
      if (!defs[col]) { allColumnsOk = false; mismatchDetail.push(`${tbl}.${col} UNEXPECTED extra column`); }
    }
  }
  const totalExpectedCols = Object.values(EXPECTED_TABLES).reduce((s, d) => s + Object.keys(d).length, 0);
  check("T2", `All columns/types/nullability match (${totalExpectedCols} columns)`,
    allColumnsOk, mismatchDetail.length ? mismatchDetail.join(" | ") : "");

  // ----- 3. Defaults -----
  const defaultChecks = {
    "users.created_at": (d) => d && d.includes("now()"),
    "reports.created_at": (d) => d && d.includes("now()"),
    "reports.status": (d) => d && d.includes("'pending'"),
    "rewards.created_at": (d) => d && d.includes("now()"),
    "rewards.updated_at": (d) => d && d.includes("now()"),
    "rewards.is_available": (d) => d && d.includes("true"),
    "rewards.points": (d) => d && d.includes("0"),
    "rewards.level": (d) => d && d.includes("1"),
    "collected_wastes.status": (d) => d && d.includes("'collected'"),
    "notifications.is_read": (d) => d && d.includes("false"),
    "notifications.created_at": (d) => d && d.includes("now()"),
    "transactions.date": (d) => d && d.includes("now()"),
  };
  let defaultsOk = true;
  const defaultDetail = [];
  for (const [key, fn] of Object.entries(defaultChecks)) {
    const [tbl, col] = key.split(".");
    let ok = false;
    for (const c of colsByTable[tbl] || []) {
      if (c.column_name === col) { ok = fn(c.column_default); if (!ok) defaultDetail.push(`${key}: default=${c.column_default || "NULL"}`); }
    }
    if (!ok) defaultsOk = false;
  }
  check("T3", "All expected column defaults present (now(), 'pending', 'collected', false, true, 0, 1)",
    defaultsOk, defaultDetail.join(" | "));

  // ----- 4 & 5. Foreign keys (count, targets, on delete/update) -----
  const fkMap = {};
  for (const r of fks) {
    const tb = String(r.tbl).replace(/^public\./, "");
    const re = String(r.ref).replace(/^public\./, "");
    const del = r.del === "a" ? "no action" : r.del === "c" ? "cascade" : r.del === "r" ? "restrict" : r.del === "n" ? "set null" : r.del;
    const upd = r.upd === "a" ? "no action" : r.upd === "c" ? "cascade" : r.upd === "r" ? "restrict" : r.upd === "n" ? "set null" : r.upd;
    fkMap[`${tb}.${r.col}`] = { ref: re, del, upd };
  }
  let fksOk = fks.length === EXPECTED_NUM_FKS;
  const fkDetail = [];
  const fkTargetsOk = [];
  for (const [tbl, cols] of Object.entries(EXPECTED_FKS)) {
    for (const [col, ref] of Object.entries(cols)) {
      const k = `${tbl}.${col}`;
      const f = fkMap[k];
      if (!f) { fksOk = false; fkDetail.push(`MISSING ${k}`); continue; }
      if (f.ref !== ref) { fksOk = false; fkDetail.push(`${k} -> ${f.ref} != ${ref}`); }
      if (f.del !== "no action" || f.upd !== "no action") { fksOk = false; fkDetail.push(`${k} onDelete=${f.del} onUpdate=${f.upd} != no action/no action`); }
      fkTargetsOk.push(`${k}→${ref} [del=${f.del}, upd=${f.upd}]`);
    }
  }
  check("T4", `Exactly ${EXPECTED_NUM_FKS} foreign keys with correct targets`,
    fksOk, fkDetail.length ? fkDetail.join(" | ") : fkTargetsOk.join(", "));
  check("T5", "FK ON DELETE / ON UPDATE = no action / no action (matches existing schema)",
    fksOk, "");

  // ----- 6. Primary keys + serial sequences -----
  const pkCols = constraints
    .filter((c) => c.constraint_type === "PRIMARY KEY")
    .reduce((m, c) => { (m[c.table_name] = m[c.table_name] || []).push(c.column_name); return m; }, {});
  let pkOk = true;
  const pkDetail = [];
  const expectedSeq = ["collected_wastes_id_seq","notifications_id_seq","reports_id_seq","rewards_id_seq","transactions_id_seq","users_id_seq"].sort();
  const actualSeq = sequences.map((s) => s.sequencename).sort();
  for (const tbl of expectedTableNames) {
    const ids = (pkCols[tbl] || []).sort();
    if (JSON.stringify(ids) !== JSON.stringify(["id"])) { pkOk = false; pkDetail.push(`${tbl} PK cols = ${ids.join(",") || "none"}`); }
    const idCol = (colsByTable[tbl] || []).find((c) => c.column_name === "id");
    if (idCol && !(idCol.column_default && idCol.column_default.includes("nextval"))) {
      pkOk = false; pkDetail.push(`${tbl}.id not sequence-backed (default=${idCol.column_default || "NULL"})`);
    }
    const seqName = `${tbl}_id_seq`;
    if (!actualSeq.includes(seqName)) { pkOk = false; pkDetail.push(`missing sequence ${seqName}`); }
  }
  check("T6", "All 6 primary keys on 'id', serial (sequence-backed), 6 matching sequences",
    pkOk && JSON.stringify(actualSeq) === JSON.stringify(expectedSeq),
    pkDetail.length ? pkDetail.join(" | ") : actualSeq.join(", "));

  // ----- 7. users.email unique -----
  const uniqueEmail = constraints.find(
    (c) => c.table_name === "users" && c.constraint_type === "UNIQUE" && c.column_name === "email",
  );
  check("T7", "users.email has UNIQUE constraint (users_email_unique)",
    !!uniqueEmail, uniqueEmail ? `constraint=${uniqueEmail.constraint_name}` : "NOT FOUND");

  // ----- 8. reports.verification_result JSONB -----
  const vres = (colsByTable.reports || []).find((c) => c.column_name === "verification_result");
  check("T8", "reports.verification_result is JSONB",
    !!vres && vres.data_type === "jsonb", vres ? `type=${vres.data_type}` : "MISSING");

  // ----- 9. No unexpected objects -----
  const expectedIndexes = [
    "users_pkey","reports_pkey","rewards_pkey","collected_wastes_pkey",
    "notifications_pkey","transactions_pkey","users_email_unique",
  ].sort();
  const actualIndexes = indexes.map((i) => i.indexname).sort();
  const extraIdx = actualIndexes.filter((x) => !expectedIndexes.includes(x));
  const missingIdx = expectedIndexes.filter((x) => !actualIndexes.includes(x));
  check("T9a", "No unexpected indexes (only PK indexes + users_email_unique)",
    extraIdx.length === 0 && missingIdx.length === 0,
    extraIdx.length ? `UNEXPECTED: ${extraIdx.join(", ")}` : (missingIdx.length ? `MISSING: ${missingIdx.join(", ")}` : `indexes: ${actualIndexes.join(", ")}`));

  check("T9b", "No real CHECK/EXCLUDE constraints on public tables (pg_constraint)",
    checkConstraints.length === 0, checkConstraints.length ? checkConstraints.map((c) => `${c.tbl}.${c.conname} => ${c.def}`).join(" | ") : "");

  check("T9c", "No user-defined enums in public schema", enums.length === 0,
    enums.length ? enums.map((e) => e.typname).join(", ") : "");

  check("T9d", "No views in public schema", views.length === 0,
    views.length ? views.map((v) => v.viewname).join(", ") : "");

  check("T9e", "No RLS policies enabled on tables in public schema", rls.length === 0,
    rls.length ? rls.map((r) => r.relname).join(", ") : "");

  check("T9f", "No triggers in public schema", triggers.length === 0,
    triggers.length ? triggers.map((t) => `${t.trigger_name} on ${t.event_object_table}`).join(", ") : "");

  // sequences already validated in T6 (expect exactly the 6 id sequences)

  // ----- 10. No data migrated -----
  const dataOk = Object.values(counts).every((n) => n === 0);
  check("T10", "No application data migrated (all 6 tables empty)",
    dataOk, Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(", "));

  const allPass = results.every((r) => r.pass);
  console.log("\n===============================================================");
  console.log(allPass ? "SCHEMA VERIFICATION: ALL CHECKS PASSED ✅" : `SCHEMA VERIFICATION: ${results.filter((r) => !r.pass).length} CHECK(S) FAILED ❌`);
  console.log(`Host verified: ${host}`);
  console.log(`Checks run: ${results.length}  |  Passed: ${results.filter((r) => r.pass).length}  |  Failed: ${results.filter((r) => !r.pass).length}`);
  console.log("===============================================================");
} catch (e) {
  console.error("Verification failed with error:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}

process.exit(results.every((r) => r.pass) ? 0 : 1);