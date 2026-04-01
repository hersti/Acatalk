-- Academic program request workflow (non-AI) for missing department/program records.

CREATE OR REPLACE FUNCTION public.detect_unit_type(p_unit_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN public.normalize_tr_text(p_unit_name) IS NULL THEN NULL
      WHEN public.normalize_tr_text(p_unit_name) LIKE '%meslek yuksekokulu%' THEN 'meslek_yuksekokulu'
      WHEN public.normalize_tr_text(p_unit_name) LIKE '%fakulte%' THEN 'fakulte'
      WHEN public.normalize_tr_text(p_unit_name) LIKE '%yuksekokul%' THEN 'yuksekokul'
      WHEN public.normalize_tr_text(p_unit_name) LIKE '%enstitu%' THEN 'enstitu'
      ELSE 'diger'
    END;
$$;

CREATE OR REPLACE FUNCTION public.infer_program_years_from_name_level(p_name text, p_program_level text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN p_program_level = 'onlisans' THEN 2
      WHEN public.normalize_tr_text(p_name) LIKE '%tip%' THEN 6
      WHEN public.normalize_tr_text(p_name) LIKE '%eczac%' THEN 5
      WHEN public.normalize_tr_text(p_name) LIKE '%dis hekim%' THEN 5
      WHEN public.normalize_tr_text(p_name) LIKE '%veteriner%' THEN 5
      WHEN public.normalize_tr_text(p_name) LIKE '%mimarlik%' THEN 5
      ELSE 4
    END;
$$;

CREATE TABLE IF NOT EXISTS public.academic_program_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_email text,
  requester_email_domain text,
  request_context text NOT NULL CHECK (request_context IN ('signup', 'content_add')),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
  university_name text NOT NULL,
  requested_program_name text NOT NULL,
  requested_program_level text NOT NULL CHECK (requested_program_level IN ('lisans', 'onlisans')),
  requested_unit_name text,
  request_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_program_name text,
  admin_program_level text CHECK (admin_program_level IN ('lisans', 'onlisans')),
  admin_unit_name text,
  admin_program_years integer CHECK (admin_program_years BETWEEN 2 AND 6),
  admin_note text,
  inserted_program_id uuid REFERENCES public.academic_programs(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_program_requests_status_idx
  ON public.academic_program_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS academic_program_requests_university_idx
  ON public.academic_program_requests (university_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS academic_program_requests_one_pending_key
  ON public.academic_program_requests (
    university_id,
    public.normalize_tr_text(requested_program_name),
    requested_program_level
  )
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS update_academic_program_requests_updated_at ON public.academic_program_requests;
CREATE TRIGGER update_academic_program_requests_updated_at
  BEFORE UPDATE ON public.academic_program_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.academic_program_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'academic_program_requests'
      AND policyname = 'Public can insert academic program requests'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public can insert academic program requests"
      ON public.academic_program_requests
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (
        status = 'pending'
        AND (
          (
            request_context = 'signup'
            AND requester_user_id IS NULL
            AND requester_email IS NOT NULL
          )
          OR
          (
            request_context = 'content_add'
            AND requester_user_id = auth.uid()
          )
        )
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'academic_program_requests'
      AND policyname = 'Users can view own academic program requests'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own academic program requests"
      ON public.academic_program_requests
      FOR SELECT
      TO authenticated
      USING (
        requester_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'academic_program_requests'
      AND policyname = 'Admins can update academic program requests'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can update academic program requests"
      ON public.academic_program_requests
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'academic_program_requests'
      AND policyname = 'Admins can delete academic program requests'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can delete academic program requests"
      ON public.academic_program_requests
      FOR DELETE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    $policy$;
  END IF;
END
$$;

GRANT SELECT, INSERT ON public.academic_program_requests TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_academic_program_request(
  p_request_context text,
  p_university_id uuid,
  p_requested_program_name text,
  p_requested_program_level text,
  p_requested_unit_name text DEFAULT NULL,
  p_request_note text DEFAULT NULL,
  p_requester_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_context text := lower(trim(coalesce(p_request_context, '')));
  v_program_name text := trim(coalesce(p_requested_program_name, ''));
  v_program_level text := lower(trim(coalesce(p_requested_program_level, '')));
  v_unit_name text := nullif(trim(coalesce(p_requested_unit_name, '')), '');
  v_note text := nullif(trim(coalesce(p_request_note, '')), '');
  v_email text := lower(trim(coalesce(p_requester_email, '')));
  v_domain text := nullif(public.normalize_email_domain(v_email), '');
  v_university record;
  v_existing_program record;
  v_existing_request record;
  v_request_id uuid;
BEGIN
  IF v_context NOT IN ('signup', 'content_add') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Gecersiz istek baglami.');
  END IF;

  IF v_program_name = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Program/bolum adi zorunludur.');
  END IF;

  IF v_program_level NOT IN ('lisans', 'onlisans') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Program seviyesi lisans veya onlisans olmalidir.');
  END IF;

  SELECT id, name
  INTO v_university
  FROM public.universities
  WHERE id = p_university_id
    AND country IN ('TR', 'KKTC')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Universite bulunamadi.');
  END IF;

  IF v_context = 'content_add' AND v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Bu islem icin giris yapmalisiniz.');
  END IF;

  IF v_context = 'signup' THEN
    IF v_email = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'Signup baglaminda e-posta zorunludur.');
    END IF;
    IF v_domain IS NULL OR NOT (v_domain LIKE '%.edu.tr' OR v_domain LIKE '%.edu') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'Sadece universite e-posta domainleri kabul edilir.');
    END IF;
  END IF;

  SELECT id, program_name
  INTO v_existing_program
  FROM public.academic_programs
  WHERE university_id = v_university.id
    AND program_name_normalized = public.normalize_tr_text(v_program_name)
    AND program_level = v_program_level
    AND is_active = true
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_exists', true,
      'reason', 'Bu program zaten katalogda mevcut.',
      'program_id', v_existing_program.id,
      'program_name', v_existing_program.program_name
    );
  END IF;

  SELECT id
  INTO v_existing_request
  FROM public.academic_program_requests
  WHERE status = 'pending'
    AND university_id = v_university.id
    AND requested_program_level = v_program_level
    AND public.normalize_tr_text(requested_program_name) = public.normalize_tr_text(v_program_name)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_pending', true,
      'reason', 'Bu program icin zaten bekleyen bir talep var.',
      'request_id', v_existing_request.id
    );
  END IF;

  INSERT INTO public.academic_program_requests (
    requester_user_id,
    requester_email,
    requester_email_domain,
    request_context,
    university_id,
    university_name,
    requested_program_name,
    requested_program_level,
    requested_unit_name,
    request_note,
    status
  ) VALUES (
    CASE WHEN v_context = 'content_add' THEN v_user_id ELSE NULL END,
    CASE WHEN v_context = 'signup' THEN v_email ELSE NULL END,
    CASE WHEN v_context = 'signup' THEN v_domain ELSE NULL END,
    v_context,
    v_university.id,
    v_university.name,
    v_program_name,
    v_program_level,
    v_unit_name,
    v_note,
    'pending'
  ) RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'reason', 'Talebiniz admin onayina gonderildi.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_academic_program_request(text, uuid, text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_process_academic_program_request(
  p_request_id uuid,
  p_action text,
  p_admin_program_name text DEFAULT NULL,
  p_admin_program_level text DEFAULT NULL,
  p_admin_unit_name text DEFAULT NULL,
  p_admin_program_years integer DEFAULT NULL,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_action text := lower(trim(coalesce(p_action, '')));
  v_req record;
  v_final_program_name text;
  v_final_program_level text;
  v_final_unit_name text;
  v_final_program_years integer;
  v_inserted record;
BEGIN
  IF NOT public.has_role(v_admin_id, 'admin'::public.app_role) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Unauthorized: admin role required.');
  END IF;

  SELECT *
  INTO v_req
  FROM public.academic_program_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Talep bulunamadi.');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Bu talep zaten islenmis.');
  END IF;

  IF v_action NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Gecersiz islem.');
  END IF;

  IF v_action = 'rejected' THEN
    UPDATE public.academic_program_requests
    SET
      status = 'rejected',
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      reviewed_by = v_admin_id,
      reviewed_at = now()
    WHERE id = v_req.id;

    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  v_final_program_name := trim(coalesce(p_admin_program_name, v_req.requested_program_name));
  v_final_program_level := lower(trim(coalesce(p_admin_program_level, v_req.requested_program_level)));
  v_final_unit_name := nullif(trim(coalesce(p_admin_unit_name, v_req.requested_unit_name, '')), '');

  IF v_final_program_name = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Program adi bos olamaz.');
  END IF;

  IF v_final_program_level NOT IN ('lisans', 'onlisans') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Program seviyesi lisans veya onlisans olmalidir.');
  END IF;

  v_final_program_years := COALESCE(
    p_admin_program_years,
    public.infer_program_years_from_name_level(v_final_program_name, v_final_program_level)
  );

  v_final_program_years := LEAST(6, GREATEST(2, v_final_program_years));

  INSERT INTO public.academic_programs (
    university_id,
    university_name,
    program_name,
    unit_name,
    unit_type,
    program_level,
    program_years,
    source,
    is_active,
    created_by
  ) VALUES (
    v_req.university_id,
    v_req.university_name,
    v_final_program_name,
    v_final_unit_name,
    public.detect_unit_type(v_final_unit_name),
    v_final_program_level,
    v_final_program_years,
    'request',
    true,
    v_admin_id
  )
  ON CONFLICT (university_id, program_name_normalized, program_level)
  DO UPDATE SET
    university_name = EXCLUDED.university_name,
    unit_name = COALESCE(EXCLUDED.unit_name, public.academic_programs.unit_name),
    unit_type = COALESCE(EXCLUDED.unit_type, public.academic_programs.unit_type),
    program_years = EXCLUDED.program_years,
    source = 'request',
    is_active = true,
    updated_at = now()
  RETURNING id, program_name, program_level
  INTO v_inserted;

  INSERT INTO public.departments (
    university,
    name,
    faculty,
    program_years,
    created_by
  ) VALUES (
    v_req.university_name,
    v_final_program_name,
    v_final_unit_name,
    v_final_program_years,
    v_admin_id
  )
  ON CONFLICT (university, name_normalized)
  DO UPDATE SET
    faculty = COALESCE(EXCLUDED.faculty, public.departments.faculty),
    program_years = EXCLUDED.program_years;

  UPDATE public.academic_program_requests
  SET
    status = 'approved',
    admin_program_name = v_final_program_name,
    admin_program_level = v_final_program_level,
    admin_unit_name = v_final_unit_name,
    admin_program_years = v_final_program_years,
    admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
    inserted_program_id = v_inserted.id,
    reviewed_by = v_admin_id,
    reviewed_at = now()
  WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'program_id', v_inserted.id,
    'program_name', v_inserted.program_name,
    'program_level', v_inserted.program_level
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_process_academic_program_request(uuid, text, text, text, text, integer, text) TO authenticated;
