CREATE POLICY "Authenticated users can insert universities"
ON public.universities
FOR INSERT
TO authenticated
WITH CHECK (true);