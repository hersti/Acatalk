-- Foundation for domain-based university resolution (TR/KKTC only)

-- 1) Universities must carry explicit country and be whitelist-bound.
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS country text;

UPDATE public.universities
SET country = 'TR'
WHERE country IS NULL OR country NOT IN ('TR', 'KKTC');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'universities_country_check'
      AND conrelid = 'public.universities'::regclass
  ) THEN
    ALTER TABLE public.universities
      ADD CONSTRAINT universities_country_check CHECK (country IN ('TR', 'KKTC'));
  END IF;
END $$;

ALTER TABLE public.universities
  ALTER COLUMN country SET NOT NULL,
  ALTER COLUMN country SET DEFAULT 'TR';

CREATE INDEX IF NOT EXISTS universities_country_idx ON public.universities (country);

-- 2) Ensure university_email_domains table DDL exists (seed migration currently assumes it exists).
CREATE TABLE IF NOT EXISTS public.university_email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  domain text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.university_email_domains
  ADD COLUMN IF NOT EXISTS university_id uuid,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'university_email_domains_university_id_fkey'
      AND conrelid = 'public.university_email_domains'::regclass
  ) THEN
    ALTER TABLE public.university_email_domains
      ADD CONSTRAINT university_email_domains_university_id_fkey
      FOREIGN KEY (university_id)
      REFERENCES public.universities(id)
      ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.university_email_domains
SET domain = lower(trim(domain))
WHERE domain IS NOT NULL;

DELETE FROM public.university_email_domains a
USING public.university_email_domains b
WHERE lower(a.domain) = lower(b.domain)
  AND a.ctid > b.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'university_email_domains_domain_lower_check'
      AND conrelid = 'public.university_email_domains'::regclass
  ) THEN
    ALTER TABLE public.university_email_domains
      ADD CONSTRAINT university_email_domains_domain_lower_check
      CHECK (domain = lower(domain));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS university_email_domains_domain_key
  ON public.university_email_domains(domain);

CREATE INDEX IF NOT EXISTS university_email_domains_university_idx
  ON public.university_email_domains(university_id);

ALTER TABLE public.university_email_domains ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'university_email_domains'
      AND policyname = 'University domains viewable by everyone'
  ) THEN
    EXECUTE 'CREATE POLICY "University domains viewable by everyone" ON public.university_email_domains FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'university_email_domains'
      AND policyname = 'Admins can insert university domains'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can insert university domains" ON public.university_email_domains FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'university_email_domains'
      AND policyname = 'Admins can update university domains'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can update university domains" ON public.university_email_domains FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'university_email_domains'
      AND policyname = 'Admins can delete university domains'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete university domains" ON public.university_email_domains FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;
END $$;
