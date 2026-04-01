-- Canonical academic catalog foundation

CREATE OR REPLACE FUNCTION public.normalize_tr_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          lower(coalesce(input, '')),
                          'ı',
                          'i'
                        ),
                        'i·',
                        'i'
                      ),
                      'ç',
                      'c'
                    ),
                    'ğ',
                    'g'
                  ),
                  'ö',
                  'o'
                ),
                'ş',
                's'
              ),
              'ü',
              'u'
            ),
            'â',
            'a'
          ),
          'î',
          'i'
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

CREATE TABLE IF NOT EXISTS public.academic_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  university_name text NOT NULL,
  program_name text NOT NULL,
  program_name_normalized text GENERATED ALWAYS AS (public.normalize_tr_text(program_name)) STORED,
  unit_name text,
  unit_name_normalized text GENERATED ALWAYS AS (public.normalize_tr_text(unit_name)) STORED,
  unit_type text CHECK (unit_type IN ('fakulte', 'yuksekokul', 'meslek_yuksekokulu', 'enstitu', 'diger')),
  program_level text NOT NULL CHECK (program_level IN ('lisans', 'onlisans')),
  program_years integer NOT NULL CHECK (program_years BETWEEN 2 AND 6),
  source text NOT NULL DEFAULT 'excel',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_programs_uni_program_level_key
  ON public.academic_programs (university_id, program_name_normalized, program_level);

CREATE INDEX IF NOT EXISTS academic_programs_university_name_idx
  ON public.academic_programs (university_name);

CREATE INDEX IF NOT EXISTS academic_programs_university_level_idx
  ON public.academic_programs (university_id, program_level);

CREATE INDEX IF NOT EXISTS academic_programs_active_idx
  ON public.academic_programs (is_active);

DROP TRIGGER IF EXISTS update_academic_programs_updated_at ON public.academic_programs;
CREATE TRIGGER update_academic_programs_updated_at
  BEFORE UPDATE ON public.academic_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.academic_programs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'academic_programs'
      AND policyname = 'Academic programs viewable by everyone'
  ) THEN
    EXECUTE 'CREATE POLICY "Academic programs viewable by everyone" ON public.academic_programs FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'academic_programs'
      AND policyname = 'Admins can insert academic programs'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can insert academic programs" ON public.academic_programs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'academic_programs'
      AND policyname = 'Admins can update academic programs'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can update academic programs" ON public.academic_programs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'academic_programs'
      AND policyname = 'Admins can delete academic programs'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete academic programs" ON public.academic_programs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;
END
$$;

GRANT SELECT ON public.academic_programs TO anon, authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university_id uuid,
  ADD COLUMN IF NOT EXISTS academic_program_id uuid,
  ADD COLUMN IF NOT EXISTS program_level text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_university_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_university_id_fkey
      FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_academic_program_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_academic_program_id_fkey
      FOREIGN KEY (academic_program_id) REFERENCES public.academic_programs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_program_level_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_program_level_check CHECK (program_level IN ('lisans', 'onlisans'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS profiles_university_id_idx ON public.profiles (university_id);
CREATE INDEX IF NOT EXISTS profiles_academic_program_id_idx ON public.profiles (academic_program_id);

UPDATE public.profiles p
SET university_id = u.id
FROM public.universities u
WHERE p.university_id IS NULL
  AND public.normalize_tr_text(p.university) = public.normalize_tr_text(u.name);

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS university_id uuid,
  ADD COLUMN IF NOT EXISTS academic_program_id uuid,
  ADD COLUMN IF NOT EXISTS program_level text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_university_id_fkey'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_university_id_fkey
      FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_academic_program_id_fkey'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_academic_program_id_fkey
      FOREIGN KEY (academic_program_id) REFERENCES public.academic_programs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_program_level_check'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_program_level_check CHECK (program_level IN ('lisans', 'onlisans'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS courses_university_id_idx ON public.courses (university_id);
CREATE INDEX IF NOT EXISTS courses_academic_program_id_idx ON public.courses (academic_program_id);

UPDATE public.courses c
SET university_id = u.id
FROM public.universities u
WHERE c.university_id IS NULL
  AND public.normalize_tr_text(c.university) = public.normalize_tr_text(u.name);

-- Backfill best-effort academic program mapping from legacy text fields.
UPDATE public.profiles p
SET academic_program_id = ap_match.id,
    program_level = ap_match.program_level
FROM public.academic_programs ap_match
WHERE p.university_id IS NOT NULL
  AND p.department IS NOT NULL
  AND p.academic_program_id IS NULL
  AND ap_match.id = (
    SELECT ap.id
    FROM public.academic_programs ap
    WHERE ap.university_id = p.university_id
      AND ap.program_name_normalized = public.normalize_tr_text(p.department)
    ORDER BY CASE WHEN ap.program_level = 'lisans' THEN 0 ELSE 1 END
    LIMIT 1
  );

UPDATE public.courses c
SET academic_program_id = ap_match.id,
    program_level = ap_match.program_level
FROM public.academic_programs ap_match
WHERE c.university_id IS NOT NULL
  AND c.department IS NOT NULL
  AND c.academic_program_id IS NULL
  AND ap_match.id = (
    SELECT ap.id
    FROM public.academic_programs ap
    WHERE ap.university_id = c.university_id
      AND ap.program_name_normalized = public.normalize_tr_text(c.department)
    ORDER BY
      CASE
        WHEN c.year IS NOT NULL AND c.year <= 2 AND ap.program_level = 'onlisans' THEN 0
        WHEN ap.program_level = 'lisans' THEN 1
        ELSE 2
      END
    LIMIT 1
  );

UPDATE public.profiles p
SET program_level = ap.program_level
FROM public.academic_programs ap
WHERE p.academic_program_id = ap.id
  AND (p.program_level IS NULL OR p.program_level <> ap.program_level);

UPDATE public.courses c
SET program_level = ap.program_level
FROM public.academic_programs ap
WHERE c.academic_program_id = ap.id
  AND (c.program_level IS NULL OR c.program_level <> ap.program_level);
