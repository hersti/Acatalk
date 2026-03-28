-- Create departments table to store validated departments as first-class records
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university TEXT NOT NULL,
  name TEXT NOT NULL,
  faculty TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- normalized name for strict duplicate prevention
  name_normalized TEXT GENERATED ALWAYS AS (
    lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))
  ) STORED
);

-- Prevent duplicates within same university (case/spacing insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS departments_university_name_norm_key
  ON public.departments (university, name_normalized);

CREATE INDEX IF NOT EXISTS departments_university_idx
  ON public.departments (university);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Policies (Postgres doesn't support IF NOT EXISTS for CREATE POLICY)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'departments'
      AND policyname = 'Departments viewable by everyone'
  ) THEN
    EXECUTE 'CREATE POLICY "Departments viewable by everyone" ON public.departments FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'departments'
      AND policyname = 'Admins can insert departments'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'departments'
      AND policyname = 'Admins can update departments'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can update departments" ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'departments'
      AND policyname = 'Admins can delete departments'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;
END
$$;
