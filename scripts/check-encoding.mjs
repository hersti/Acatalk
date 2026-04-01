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
  "\u00C3\u00BC", // Ã¼
  "\u00C3\u00B6", // Ã¶
  "\u00C3\u00A7", // Ã§
  "\u00C4\u00B1", // Ä±
  "\u00C4\u00B0", // Ä°
  "\u00C5\u009F", // ÅŸ
  "\u00C5\u009E", // Åž
  "\u00C3\u009C", // Ãœ
  "\u00C3\u0087", // Ã‡
  "\u00C2\u00B7", // Â·
  "\u00E2\u0080\u0094", // â€”
  "\u00E2\u009C\u0093", // âœ“
  "\u00E2\u0080\u009C", // â€œ
  "\u00E2\u0080\u009D", // â€
  "\u00E2\u0080\u0099", // â€™
  "\u00E2\u0086\u0092", // â†’
  "\u00F0\u0178", // ðŸ
];

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

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

function scanFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (isLikelyBinary(buffer)) return null;

  const hasBom = buffer.length >= 3 && buffer.subarray(0, 3).equals(BOM);
  const content = buffer.toString("utf8");

  const hitTokens = [];
  for (const token of MOJIBAKE_TOKENS) {
    if (content.includes(token)) {
      hitTokens.push(token);
    }
  }

  if (!hasBom && hitTokens.length === 0) return null;

  return {
    file: filePath,
    bom: hasBom ? "yes" : "no",
    mojibakeCount: hitTokens.length,
    mojibakeTokens: hitTokens.join(" | "),
  };
}

function main() {
  const trackedFiles = getTrackedFiles();
  const violations = [];

  for (const filePath of trackedFiles) {
    if (!hasTextExtension(filePath)) continue;
    const violation = scanFile(filePath);
    if (violation) violations.push(violation);
  }

  console.log("\nEncoding check report");
  console.log("====================");

  if (violations.length === 0) {
    console.log("No BOM or mojibake token violations found.\n");
    return;
  }

  console.table(violations);

  const bomCount = violations.filter((item) => item.bom === "yes").length;
  const mojibakeFileCount = violations.filter((item) => item.mojibakeCount > 0).length;

  console.log(`Violations: ${violations.length}`);
  console.log(`- Files with BOM: ${bomCount}`);
  console.log(`- Files with mojibake tokens: ${mojibakeFileCount}`);
  process.exitCode = 1;
}

main();