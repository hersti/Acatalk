-- Canonical catalog integrity hardening: university type normalization + replacement-char cleanup

UPDATE public.universities
SET type = CASE
  WHEN public.normalize_tr_text(type) LIKE '%devlet%' THEN 'devlet'
  WHEN public.normalize_tr_text(type) LIKE '%vakif%' THEN 'vakif'
  ELSE NULL
END
WHERE type IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'universities_type_check'
      AND conrelid = 'public.universities'::regclass
  ) THEN
    ALTER TABLE public.universities
      ADD CONSTRAINT universities_type_check
      CHECK (type IS NULL OR type IN ('devlet', 'vakif'));
  END IF;
END
$$;

-- Repair occasional replacement-character corruption on canonical institutional fields.
UPDATE public.universities
SET name = replace(name, '�', 'Ü')
WHERE name LIKE '%�%';

UPDATE public.academic_programs
SET university_name = replace(university_name, '�', 'Ü')
WHERE university_name LIKE '%�%';

UPDATE public.departments
SET university = replace(university, '�', 'Ü')
WHERE university LIKE '%�%';

UPDATE public.courses
SET university = replace(university, '�', 'Ü')
WHERE university LIKE '%�%';