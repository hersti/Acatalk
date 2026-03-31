-- Unknown university/domain request queue (admin-approved only)

CREATE TABLE IF NOT EXISTS public.university_domain_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  request_email text NOT NULL,
  request_email_domain text NOT NULL,
  claimed_university_name text NOT NULL,
  request_note text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text NULL,
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  resolved_university_id uuid NULL REFERENCES public.universities(id) ON DELETE SET NULL,
  resolved_domain text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS university_domain_requests_status_idx
  ON public.university_domain_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS university_domain_requests_domain_idx
  ON public.university_domain_requests(request_email_domain);

CREATE UNIQUE INDEX IF NOT EXISTS university_domain_requests_one_pending_per_domain_key
  ON public.university_domain_requests(request_email_domain)
  WHERE status = 'pending';

ALTER TABLE public.university_domain_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'university_domain_requests'
      AND policyname = 'Admins can view domain requests'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view domain requests" ON public.university_domain_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'university_domain_requests'
      AND policyname = 'Admins can update domain requests'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can update domain requests" ON public.university_domain_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'university_domain_requests'
      AND policyname = 'Admins can delete domain requests'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete domain requests" ON public.university_domain_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_university_domain_requests_updated_at ON public.university_domain_requests;
CREATE TRIGGER update_university_domain_requests_updated_at
  BEFORE UPDATE ON public.university_domain_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
