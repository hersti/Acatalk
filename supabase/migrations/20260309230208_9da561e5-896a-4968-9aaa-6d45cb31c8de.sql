
-- Remove the overly permissive system insert policy (service role bypasses RLS)
DROP POLICY IF EXISTS "System can insert universities" ON public.universities;
