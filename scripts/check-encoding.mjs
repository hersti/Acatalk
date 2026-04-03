import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".md", ".css", ".scss", ".html", ".sql",
  ".toml", ".yml", ".yaml", ".txt", ".env", ".ini",
  ".config", ".xml",
]);

const MOJIBAKE_TOKENS = [
  "\u00C3\u00BC",
  "\u00C3\u00B6",
  "\u00C3\u00A7",
  "\u00C4\u00B1",
  "\u00C4\u00B0",
  "\u00C5\u009F",
  "\u00C5\u009E",
  "\u00C3\u009C",
  "\u00C3\u0087",
  "\u00C2\u00B7",
  "\u00E2\u0080\u0094",
  "\u00E2\u009C\u0093",
  "\u00E2\u0080\u009C",
  "\u00E2\u0080\u009D",
  "\u00E2\u0080\u0099",
  "\u00E2\u0086\u0092",
  "\u00F0\u0178",
];

const TRANSLITERATION_PATTERNS = [
  { token: "Universite", regex: /\bUniversite\b/g },
  { token: "Bolum", regex: /\bBolum\b/g },
  { token: "Sinif", regex: /\bSinif\b/g },
  { token: "Hazirlik", regex: /\bHazirlik\b/g },
  { token: "Guvenlik", regex: /\bGuvenlik\b/g },
  { token: "Lutfen", regex: /\bLutfen\b/g },
  { token: "Yonetici", regex: /\bYonetici\b/g },
  { token: "Dogrulanmis", regex: /\bDogrulanmis\b/g },
  { token: "yukleniyor", regex: /\byukleniyor\b/g },
  { token: "bulunamadi", regex: /\bbulunamadi\b/g },
  { token: "onaylandi", regex: /\bonaylandi\b/g },
  { token: "onaylanamadi", regex: /\bonaylanamadi\b/g },
  { token: "tarafindan", regex: /\btarafindan\b/g },
  { token: "kuyrugunda", regex: /\bkuyrugunda\b/g },
  { token: "islenmez", regex: /\bislenmez\b/g },
  { token: "aliniyor", regex: /\baliniyor\b/g },
];

const TRANSLITERATION_LINE_ALLOWLIST = [
  /@universite\.edu\.tr/i,
  /kullanici_adi/i,
];

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const args = new Set(process.argv.slice(2));
const copyOnly = args.has("--copy-only");
const encodingOnly = args.has("--encoding-only");
const runEncodingChecks = !copyOnly;
const runCopyChecks = !encodingOnly;

function getTrackedFiles() {
  const output = execSync("git ls-files -z", { encoding: "buffer" });
  return output
    .toString("utf8")
    .split("\0")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasTextExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  const base = path.basename(filePath);
  if ([".editorconfig", ".gitignore"].includes(base)) return true;
  return false;
}

function isLikelyBinary(buffer) {
  if (!buffer || buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  return sample.includes(0x00);
}

function isAllowlistedTransliterationLine(line) {
  return TRANSLITERATION_LINE_ALLOWLIST.some((rule) => rule.test(line));
}

function scanTransliteration(filePath, content) {
  const lines = content.split(/\r?\n/);
  const hits = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || isAllowlistedTransliterationLine(line)) continue;

    for (const pattern of TRANSLITERATION_PATTERNS) {
      if (pattern.regex.test(line)) {
        hits.push({
          file: filePath,
          line: index + 1,
          token: pattern.token,
          preview: line.trim().slice(0, 140),
        });
      }
      pattern.regex.lastIndex = 0;
    }
  }

  return hits;
}

function scanFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (isLikelyBinary(buffer)) return null;

  const content = buffer.toString("utf8");
  const hasBom = runEncodingChecks && buffer.length >= 3 && buffer.subarray(0, 3).equals(BOM);

  const hitTokens = [];
  if (runEncodingChecks) {
    for (const token of MOJIBAKE_TOKENS) {
      if (content.includes(token)) {
        hitTokens.push(token);
      }
    }
  }

  const shouldRunTransliteration =
    runCopyChecks && (filePath.startsWith("src/") || filePath.startsWith("src\\"));
  const transliterationHits = shouldRunTransliteration
    ? scanTransliteration(filePath, content)
    : [];

  if (!hasBom && hitTokens.length === 0 && transliterationHits.length === 0) return null;

  return {
    file: filePath,
    bom: hasBom ? "yes" : "no",
    mojibakeCount: hitTokens.length,
    mojibakeTokens: hitTokens.join(" | "),
    transliterationCount: transliterationHits.length,
    transliterationHits,
  };
}

function main() {
  const trackedFiles = getTrackedFiles();
  const violations = [];
  const transliterationViolations = [];

  for (const filePath of trackedFiles) {
    if (!hasTextExtension(filePath)) continue;
    const violation = scanFile(filePath);
    if (violation) {
      violations.push(violation);
      if (violation.transliterationHits.length > 0) {
        transliterationViolations.push(...violation.transliterationHits);
      }
    }
  }

  console.log("\nQuality check report");
  console.log("====================");

  if (violations.length === 0) {
    if (runEncodingChecks && runCopyChecks) {
      console.log("No BOM, mojibake, or transliteration token violations found.\n");
    } else if (runEncodingChecks) {
      console.log("No BOM or mojibake token violations found.\n");
    } else {
      console.log("No transliteration token violations found.\n");
    }
    return;
  }

  if (runEncodingChecks) {
    const encodingViolations = violations.filter(
      (item) => item.bom === "yes" || item.mojibakeCount > 0,
    );
    if (encodingViolations.length > 0) {
      console.log("\nEncoding issues");
      console.table(
        encodingViolations.map((item) => ({
          file: item.file,
          bom: item.bom,
          mojibakeCount: item.mojibakeCount,
          mojibakeTokens: item.mojibakeTokens,
        })),
      );
    }
  }

  if (runCopyChecks && transliterationViolations.length > 0) {
    console.log("\nCopy/transliteration issues");
    console.table(transliterationViolations);
  }

  const bomCount = violations.filter((item) => item.bom === "yes").length;
  const mojibakeFileCount = violations.filter((item) => item.mojibakeCount > 0).length;
  const transliterationFileCount = violations.filter(
    (item) => item.transliterationCount > 0,
  ).length;

  console.log(`Violations: ${violations.length}`);
  if (runEncodingChecks) {
    console.log(`- Files with BOM: ${bomCount}`);
    console.log(`- Files with mojibake tokens: ${mojibakeFileCount}`);
  }
  if (runCopyChecks) {
    console.log(`- Files with transliteration tokens: ${transliterationFileCount}`);
  }
  process.exitCode = 1;
}

main();
