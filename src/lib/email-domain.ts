function normalizeDomain(domain: string): string {
  const punycodeMap: Record<string, string> = {
    "xn--it-yka": "itu",
    "xn--gm-yka": "gmu",
    "xn--bm-yka": "bmu",
  };

  return String(domain || "")
    .trim()
    .toLowerCase()
    .split(".")
    .map((part) => punycodeMap[part] || part)
    .join(".")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/þ/g, "s")
    .replace(/ç/g, "c")
    .replace(/ð/g, "g")
    .replace(/ý/g, "i")
    .replace(/i·/g, "i");
}

export function extractEmailDomain(email: string): string {
  const parts = String(email || "").trim().toLowerCase().split("@");
  if (parts.length !== 2) return "";
  return normalizeDomain(parts[1]);
}
