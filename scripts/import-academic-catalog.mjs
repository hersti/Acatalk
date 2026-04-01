import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const ROOT_HINT = process.env.ACADEMIC_IMPORT_ROOT || "C:/Users/ozgur/Desktop";

const TARGET_FILES = {
  universities: ['bilesik_kume_universiteler.xlsx'],
  lisans: ['lisans_herbokolog_fakulte_temizlenmis.xlsx'],
  onlisans: ['onlisans_herbokolog.xlsx'],
};

function clean(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function fold(value) {
  return clean(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/i·/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u");
}

function titleCaseTr(value) {
  const text = clean(value);
  if (!text) return "";

  return text
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((part) => {
      if (!part) return part;
      return part[0].toLocaleUpperCase("tr-TR") + part.slice(1);
    })
    .join(" ")
    .replace(/\bi·/gi, "İ");
}

function normalizeType(value) {
  const raw = fold(value);
  if (!raw) return null;
  if (raw.includes("devlet")) return "devlet";
  if (raw.includes("vakif") || raw.includes("vakıf")) return "vakif";
  return null;
}

function detectUnitType(unitName) {
  const raw = fold(unitName);
  if (!raw) return null;
  if (raw.includes("meslek yuksekokulu")) return "meslek_yuksekokulu";
  if (raw.includes("fakulte")) return "fakulte";
  if (raw.includes("yuksekokul")) return "yuksekokul";
  if (raw.includes("enstitu")) return "enstitu";
  return "diger";
}

function inferProgramYears(programName, level) {
  if (level === "onlisans") return 2;
  const raw = fold(programName);
  if (!raw) return 4;
  if (raw.includes("tip")) return 6;
  if (raw.includes("eczac")) return 5;
  if (raw.includes("dis hekim")) return 5;
  if (raw.includes("veteriner")) return 5;
  if (raw.includes("mimarlik")) return 5;
  return 4;
}

function walkFiles(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, output);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".xlsx")) {
      output.push(fullPath);
    }
  }
  return output;
}

function foldLoose(value) {
  return fold(value).replace(/[^a-z0-9.]/g, '');
}

function findWorkbookPath(allFiles, expectedBaseNames) {
  const expectedList = Array.isArray(expectedBaseNames) ? expectedBaseNames : [expectedBaseNames];
  const foldedExpectedList = expectedList.map((name) => fold(name));

  const exact = allFiles.find((filePath) => {
    const foldedBase = fold(path.basename(filePath));
    return foldedExpectedList.includes(foldedBase);
  });
  if (exact) return exact;

  const looseExpectedList = expectedList.map((name) => foldLoose(name));
  return allFiles.find((filePath) => {
    const looseBase = foldLoose(path.basename(filePath));
    return looseExpectedList.some((expected) => looseBase.includes(expected) || expected.includes(looseBase));
  });
}

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function findColumnKey(row, aliases) {
  const entries = Object.keys(row || {});
  for (const alias of aliases) {
    const normalizedAlias = fold(alias);
    const key = entries.find((k) => fold(k) === normalizedAlias);
    if (key) return key;
  }
  return null;
}

async function upsertBatches(client, table, rows, onConflict, batchSize = 500) {
  let total = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const chunk = rows.slice(index, index + batchSize);
    if (chunk.length === 0) continue;
    const { error } = await client.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Upsert failed for ${table}: ${error.message}`);
    }
    total += chunk.length;
  }
  return total;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  const allXlsxFiles = walkFiles(ROOT_HINT);
  const universitiesPath = findWorkbookPath(allXlsxFiles, TARGET_FILES.universities);
  const lisansPath = findWorkbookPath(allXlsxFiles, TARGET_FILES.lisans);
  const onlisansPath = findWorkbookPath(allXlsxFiles, TARGET_FILES.onlisans);

  if (!universitiesPath || !lisansPath || !onlisansPath) {
    throw new Error(
      `Workbook not found. Resolved paths => universities: ${universitiesPath}, lisans: ${lisansPath}, onlisans: ${onlisansPath}`
    );
  }

  console.log("Using files:");
  console.log("- universities:", universitiesPath);
  console.log("- lisans:", lisansPath);
  console.log("- onlisans:", onlisansPath);

  const universitiesRows = readRows(universitiesPath);
  const lisansRows = readRows(lisansPath);
  const onlisansRows = readRows(onlisansPath);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingUniversities, error: existingUniError } = await supabase
    .from("universities")
    .select("id,name,country,type")
    .in("country", ["TR", "KKTC"]);

  if (existingUniError) {
    throw new Error(`Failed to load existing universities: ${existingUniError.message}`);
  }

  const existingUniversityByNorm = new Map();
  for (const uni of existingUniversities || []) {
    existingUniversityByNorm.set(fold(uni.name), uni);
  }

  const incomingUniversityMap = new Map();

  function collectUniversities(rows, { nameAliases, typeAliases }) {
    for (const row of rows) {
      const nameKey = findColumnKey(row, nameAliases);
      if (!nameKey) continue;

      const rawName = clean(row[nameKey]);
      if (!rawName || fold(rawName).includes("universite adi")) continue;

      const normalized = fold(rawName);
      const typeKey = findColumnKey(row, typeAliases);
      const mappedType = typeKey ? normalizeType(row[typeKey]) : null;

      const current = incomingUniversityMap.get(normalized) || {
        rawName,
        mappedType: null,
      };

      if (!current.rawName) current.rawName = rawName;
      if (!current.mappedType && mappedType) current.mappedType = mappedType;

      incomingUniversityMap.set(normalized, current);
    }
  }

  collectUniversities(universitiesRows, {
    nameAliases: ["Üniversite Adı", "Universite Adi"],
    typeAliases: ["Üniversite Türü", "Universite Turu"],
  });

  collectUniversities(lisansRows, {
    nameAliases: ["Üniversite Adı", "Universite Adi"],
    typeAliases: ["Üniversite Türü", "Universite Turu"],
  });

  collectUniversities(onlisansRows, {
    nameAliases: ["Üniversite Adı", "Universite Adi"],
    typeAliases: ["Üniversite Türü", "Universite Turu"],
  });

  const universityUpserts = [];
  for (const [normalized, entry] of incomingUniversityMap.entries()) {
    const existing = existingUniversityByNorm.get(normalized);
    const resolvedName = existing?.name || titleCaseTr(entry.rawName);
    const resolvedType = entry.mappedType || normalizeType(existing?.type) || null;
    const resolvedCountry = existing?.country || "TR";

    universityUpserts.push({
      name: resolvedName,
      type: resolvedType,
      country: resolvedCountry,
    });
  }

  await upsertBatches(supabase, "universities", universityUpserts, "name");

  const { data: allUniversitiesAfterUpsert, error: allUniError } = await supabase
    .from("universities")
    .select("id,name,country,type")
    .in("country", ["TR", "KKTC"]);

  if (allUniError) {
    throw new Error(`Failed to fetch universities after upsert: ${allUniError.message}`);
  }

  const universityByNorm = new Map();
  for (const uni of allUniversitiesAfterUpsert || []) {
    universityByNorm.set(fold(uni.name), uni);
  }

  const academicProgramMap = new Map();
  const legacyDepartmentMap = new Map();

  function processPrograms(rows, programLevel) {
    for (const row of rows) {
      const uniKey = findColumnKey(row, ["Üniversite Adı", "Universite Adi"]);
      const unitKey = findColumnKey(row, ["Fakülte/Yüksekokul Adı", "Fakulte/Yuksekokul Adi"]);
      const programKey = findColumnKey(row, ["Program Adı", "Program Adi"]);

      if (!uniKey || !programKey) continue;

      const rawUniversityName = clean(row[uniKey]);
      const rawProgramName = clean(row[programKey]);
      const rawUnitName = unitKey ? clean(row[unitKey]) : "";

      if (!rawUniversityName || !rawProgramName) continue;
      if (fold(rawUniversityName).includes("universite adi") || fold(rawProgramName).includes("program adi")) continue;

      const university = universityByNorm.get(fold(rawUniversityName));
      if (!university?.id) continue;

      const programName = titleCaseTr(rawProgramName);
      const unitName = rawUnitName ? titleCaseTr(rawUnitName) : null;
      const unitType = detectUnitType(unitName);
      const programYears = inferProgramYears(programName, programLevel);

      const academicKey = `${university.id}::${fold(programName)}::${programLevel}`;
      if (!academicProgramMap.has(academicKey)) {
        academicProgramMap.set(academicKey, {
          university_id: university.id,
          university_name: university.name,
          program_name: programName,
          unit_name: unitName,
          unit_type: unitType,
          program_level: programLevel,
          program_years: programYears,
          source: "excel",
          is_active: true,
        });
      } else {
        const existing = academicProgramMap.get(academicKey);
        if (!existing.unit_name && unitName) {
          existing.unit_name = unitName;
          existing.unit_type = unitType;
        }
        if (programYears > existing.program_years) {
          existing.program_years = programYears;
        }
      }

      const legacyKey = `${university.name}::${fold(programName)}`;
      if (!legacyDepartmentMap.has(legacyKey)) {
        legacyDepartmentMap.set(legacyKey, {
          university: university.name,
          name: programName,
          faculty: unitName,
          program_years: programYears,
        });
      } else {
        const existing = legacyDepartmentMap.get(legacyKey);
        if (!existing.faculty && unitName) {
          existing.faculty = unitName;
        }
        if (programYears > existing.program_years) {
          existing.program_years = programYears;
        }
      }
    }
  }

  processPrograms(lisansRows, "lisans");
  processPrograms(onlisansRows, "onlisans");

  const academicPrograms = Array.from(academicProgramMap.values());
  const legacyDepartments = Array.from(legacyDepartmentMap.values());

  await upsertBatches(
    supabase,
    "academic_programs",
    academicPrograms,
    "university_id,program_name_normalized,program_level"
  );

  await upsertBatches(
    supabase,
    "departments",
    legacyDepartments,
    "university,name_normalized"
  );

  console.log("Import completed successfully.");
  console.log(`- universities upserted: ${universityUpserts.length}`);
  console.log(`- academic_programs upserted: ${academicPrograms.length}`);
  console.log(`- legacy departments upserted: ${legacyDepartments.length}`);

  console.log("Running catalog integrity check...");
  const { runCatalogIntegrityCheck } = await import("./check-catalog-integrity.mjs");
  await runCatalogIntegrityCheck();
}

main().catch((error) => {
  console.error("Import failed:", error?.message || error);
  process.exitCode = 1;
});

