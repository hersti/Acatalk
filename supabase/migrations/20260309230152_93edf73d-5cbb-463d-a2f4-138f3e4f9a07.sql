
-- Create universities table for storing university metadata
CREATE TABLE public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  city text,
  type text DEFAULT 'devlet',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- Everyone can view universities
CREATE POLICY "Universities viewable by everyone"
  ON public.universities FOR SELECT TO public
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can insert universities"
  ON public.universities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update universities"
  ON public.universities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete universities"
  ON public.universities FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow service role / system inserts (for edge function)
CREATE POLICY "System can insert universities"
  ON public.universities FOR INSERT TO public
  WITH CHECK (true);

-- Seed existing DB-only university
INSERT INTO public.universities (name, city, type)
SELECT DISTINCT d.university, NULL, NULL
FROM public.departments d
WHERE d.university NOT IN (SELECT name FROM public.universities)
ON CONFLICT (name) DO NOTHING;
