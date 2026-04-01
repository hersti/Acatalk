import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const MOJIBAKE_TOKENS = [
  "\u00C3\u00BC", "\u00C3\u00B6", "\u00C3\u00A7", "\u00C4\u00B1", "\u00C4\u00B0",
  "\u00C5\u009F", "\u00C5\u009E", "\u00C3\u009C", "\u00C3\u0087", "\u00C2\u00B7",
  "\u00E2\u0080\u0094", "\u00E2\u009C\u0093", "\u00E2\u0080\u009C", "\u00E2\u0080\u009D",
  "\u00E2\u0080\u0099", "\u00E2\u0086\u0092", "\u00F0\u0178",
];

const TABLES_TO_SCAN = [
  { table: "universities", columns: ["id", "name", "city", "type", "country"] },
  { table: "academic_programs", columns: ["id", "university_name", "program_name", "unit_name"] },
  { table: "departments", columns: ["id", "university", "name", "faculty"] },
  { table: "courses", columns: ["id", "university", "department", "name", "code", "description"] },
];

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchAllRows(client, table, columns, batchSize = 1000) {
  const selected = columns.join(",");
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await client
      .from(table)
      .select(selected)
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }

    const chunk = data || [];
    rows.push(...chunk);

    if (chunk.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

function countMojibakeInValue(value) {
  if (!value || typeof value !== "string") return 0;

  let count = 0;
  for (const token of MOJIBAKE_TOKENS) {
    if (value.includes(token)) count += 1;
  }
  if (value.includes("\uFFFD")) count += 1;

  return count;
}

function normalizeUniversityType(value) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

export async function runCatalogIntegrityCheck() {
  const supabase = getSupabaseClient();

  const universityRows = await fetchAllRows(supabase, "universities", ["id", "type", "country"]);
  const trRows = universityRows.filter((row) => ["TR", "KKTC"].includes(String(row.country || "")));

  let nullTypeCount = 0;
  let invalidTypeCount = 0;

  for (const row of trRows) {
    const normalizedType = normalizeUniversityType(row.type);
    if (!normalizedType) {
      nullTypeCount += 1;
      continue;
    }
    if (normalizedType !== "devlet" && normalizedType !== "vakif") {
      invalidTypeCount += 1;
    }
  }

  const perTableMojibake = [];
  let totalMojibakeHits = 0;

  for (const config of TABLES_TO_SCAN) {
    const rows = await fetchAllRows(supabase, config.table, config.columns);
    let tableHits = 0;
    let affectedRows = 0;

    for (const row of rows) {
      let rowHits = 0;
      for (const column of config.columns) {
        rowHits += countMojibakeInValue(row[column]);
      }
      if (rowHits > 0) {
        affectedRows += 1;
        tableHits += rowHits;
      }
    }

    totalMojibakeHits += tableHits;
    perTableMojibake.push({
      table: config.table,
      rows: rows.length,
      affectedRows,
      mojibakeHits: tableHits,
    });
  }

  console.log("\nCatalog integrity report");
  console.log("========================");
  console.log(`universities.type null (TR/KKTC): ${nullTypeCount}`);
  console.log(`universities.type invalid (TR/KKTC): ${invalidTypeCount}`);
  console.table(perTableMojibake);
  console.log(`Total canonical mojibake hits: ${totalMojibakeHits}`);

  const hasViolations = nullTypeCount > 0 || invalidTypeCount > 0 || totalMojibakeHits > 0;
  if (hasViolations) {
    throw new Error("Catalog integrity violations detected.");
  }

  return {
    nullTypeCount,
    invalidTypeCount,
    totalMojibakeHits,
    perTableMojibake,
  };
}

async function main() {
  try {
    await runCatalogIntegrityCheck();
  } catch (error) {
    console.error("Integrity check failed:", error?.message || error);
    process.exitCode = 1;
  }
}

const directRun = process.argv[1] && process.argv[1].endsWith("check-catalog-integrity.mjs");
if (directRun) {
  void main();
}