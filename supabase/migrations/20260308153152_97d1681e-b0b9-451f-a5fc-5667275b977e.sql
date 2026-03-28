
-- Course wiki table (one per course)
CREATE TABLE public.course_wikis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  description text,
  teaching_style text,
  exam_system text,
  difficulty_comment text,
  recommended_sources text,
  important_topics text,
  past_years_info text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.course_wikis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wiki viewable by everyone" ON public.course_wikis FOR SELECT USING (true);
CREATE POLICY "Admins can insert wiki" ON public.course_wikis FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update wiki" ON public.course_wikis FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete wiki" ON public.course_wikis FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Course resources table
CREATE TABLE public.course_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  url text,
  resource_type text NOT NULL DEFAULT 'website',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resources viewable by everyone" ON public.course_resources FOR SELECT USING (true);
CREATE POLICY "Admins can insert resources" ON public.course_resources FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update resources" ON public.course_resources FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete resources" ON public.course_resources FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
