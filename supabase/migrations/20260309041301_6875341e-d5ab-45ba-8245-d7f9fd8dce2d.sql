
-- Academic suggestions table for department/course requests
CREATE TABLE public.academic_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('department', 'course')),
  university text NOT NULL,
  faculty text,
  department text,
  course_name text,
  course_code text,
  class_year text,
  explanation text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_confidence numeric,
  ai_reason text,
  normalized_name text,
  inserted_id uuid,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.academic_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own suggestions
CREATE POLICY "Users can submit suggestions"
ON public.academic_suggestions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own suggestions
CREATE POLICY "Users can view own suggestions"
ON public.academic_suggestions FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admins can update suggestions
CREATE POLICY "Admins can update suggestions"
ON public.academic_suggestions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete suggestions
CREATE POLICY "Admins can delete suggestions"
ON public.academic_suggestions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- System (edge functions) can insert via service role
CREATE POLICY "System can insert suggestions"
ON public.academic_suggestions FOR INSERT
WITH CHECK (true);
