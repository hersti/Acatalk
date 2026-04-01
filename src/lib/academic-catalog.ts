import { supabase } from "@/integrations/supabase/client";

export type ProgramLevel = "lisans" | "onlisans";

export type UniversityCatalogRow = {
  id: string;
  name: string;
  city: string | null;
  type: string | null;
  country: string;
};

export type AcademicProgramRow = {
  id: string;
  university_id: string;
  university_name: string;
  program_name: string;
  unit_name: string | null;
  program_level: ProgramLevel;
  program_years: number;
};

export function normalizeProgramLevel(value: string | null | undefined): ProgramLevel {
  const normalized = String(value || "").trim().toLocaleLowerCase("tr-TR");
  return normalized === "onlisans" ? "onlisans" : "lisans";
}

export function inferProgramYears(programName: string, level?: ProgramLevel | null): number {
  const normalizedLevel = normalizeProgramLevel(level || null);
  if (normalizedLevel === "onlisans") return 2;

  const lower = String(programName || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();

  if (lower.includes("týp")) return 6;

  if (
    lower.includes("eczac") ||
    lower.includes("diþ hekim") ||
    lower.includes("veteriner") ||
    lower.includes("mimarlýk")
  ) {
    return 5;
  }

  return 4;
}

export function buildYearOptions(maxYears: number): Array<{ value: string; label: string }> {
  const safeMax = Math.min(6, Math.max(2, Math.trunc(maxYears || 4)));
  return [
    { value: "0", label: "Hazýrlýk" },
    ...Array.from({ length: safeMax }, (_, index) => ({
      value: String(index + 1),
      label: `${index + 1}. Sýnýf`,
    })),
  ];
}

export async function fetchUniversitiesCatalog(): Promise<UniversityCatalogRow[]> {
  const { data, error } = await supabase
    .from("universities" as any)
    .select("id,name,city,type,country")
    .in("country", ["TR", "KKTC"])
    .order("name", { ascending: true })
    .limit(2000);

  if (error) {
    throw error;
  }

  return (data || []) as UniversityCatalogRow[];
}

export async function fetchAcademicProgramsForUniversity(
  universityName: string,
  level?: ProgramLevel | null
): Promise<AcademicProgramRow[]> {
  const trimmedName = String(universityName || "").trim();
  if (!trimmedName) return [];

  let query = supabase
    .from("academic_programs" as any)
    .select("id,university_id,university_name,program_name,unit_name,program_level,program_years")
    .eq("is_active", true)
    .eq("university_name", trimmedName)
    .order("program_name", { ascending: true });

  if (level) {
    query = query.eq("program_level", normalizeProgramLevel(level));
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []) as AcademicProgramRow[];
}

export async function resolveUniversityByName(universityName: string): Promise<UniversityCatalogRow | null> {
  const trimmedName = String(universityName || "").trim();
  if (!trimmedName) return null;

  const { data, error } = await supabase
    .from("universities" as any)
    .select("id,name,city,type,country")
    .eq("name", trimmedName)
    .in("country", ["TR", "KKTC"])
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as UniversityCatalogRow | null) || null;
}
