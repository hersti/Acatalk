-- RPCs for DB-driven university domain resolution and admin approval flow

CREATE OR REPLACE FUNCTION public.normalize_email_domain(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_domain text;
BEGIN
  IF p_email IS NULL THEN
    RETURN '';
  END IF;

  v_domain := lower(trim(split_part(p_email, '@', 2)));
  IF v_domain IS NULL THEN
    RETURN '';
  END IF;

  RETURN trim(v_domain);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_university_by_email_domain(p_email text)
RETURNS TABLE (
  found boolean,
  university_id uuid,
  university_name text,
  domain text,
  country text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_domain text;
  v_probe text;
BEGIN
  v_domain := public.normalize_email_domain(p_email);

  IF v_domain = '' OR position('.' in v_domain) = 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  v_probe := v_domain;

  LOOP
    RETURN QUERY
    SELECT true, u.id, u.name, ued.domain, u.country
    FROM public.university_email_domains ued
    JOIN public.universities u ON u.id = ued.university_id
    WHERE ued.domain = v_probe
      AND u.country IN ('TR', 'KKTC')
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;

    EXIT WHEN position('.' in v_probe) = 0;
    v_probe := substring(v_probe from position('.' in v_probe) + 1);
  END LOOP;

  RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_university_domain_request(
  p_request_email text,
  p_claimed_university_name text,
  p_request_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_domain text;
  v_claimed text;
  v_pending_id uuid;
  v_known record;
  v_inserted_id uuid;
BEGIN
  v_domain := public.normalize_email_domain(p_request_email);
  v_claimed := trim(coalesce(p_claimed_university_name, ''));

  IF v_domain = '' OR position('.' in v_domain) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Geçersiz e-posta adresi.');
  END IF;

  IF NOT (v_domain LIKE '%.edu.tr' OR v_domain LIKE '%.edu') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Sadece üniversite e-posta domainleri kabul edilir.');
  END IF;

  IF v_claimed = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Üniversite adı zorunludur.');
  END IF;

  SELECT * INTO v_known
  FROM public.resolve_university_by_email_domain(p_request_email)
  LIMIT 1;

  IF coalesce(v_known.found, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'already_known', true,
      'university_name', v_known.university_name,
      'domain', v_known.domain,
      'reason', 'Bu domain zaten sistemde kayıtlı.'
    );
  END IF;

  SELECT id INTO v_pending_id
  FROM public.university_domain_requests
  WHERE request_email_domain = v_domain
    AND status = 'pending'
  LIMIT 1;

  IF v_pending_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'already_pending', true,
      'request_id', v_pending_id,
      'reason', 'Bu domain için zaten bekleyen bir talep var.'
    );
  END IF;

  INSERT INTO public.university_domain_requests (
    requester_user_id,
    request_email,
    request_email_domain,
    claimed_university_name,
    request_note,
    status
  )
  VALUES (
    v_user_id,
    lower(trim(p_request_email)),
    v_domain,
    v_claimed,
    nullif(trim(coalesce(p_request_note, '')), ''),
    'pending'
  )
  RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'pending',
    'request_id', v_inserted_id,
    'reason', 'Talebiniz admin incelemesine gönderildi.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_process_university_domain_request(
  p_request_id uuid,
  p_action text,
  p_university_name text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_admin_note text DEFAULT NULL,
  p_seed_general_department boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_req record;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_country text := upper(trim(coalesce(p_country, '')));
  v_domain text := lower(trim(coalesce(p_domain, '')));
  v_uni_name text := trim(coalesce(p_university_name, ''));
  v_university_id uuid;
BEGIN
  IF NOT public.has_role(v_admin_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO v_req
  FROM public.university_domain_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  IF v_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  IF v_action = 'rejected' THEN
    UPDATE public.university_domain_requests
    SET
      status = 'rejected',
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'request_id', p_request_id);
  END IF;

  IF v_uni_name = '' THEN
    RAISE EXCEPTION 'University name is required for approval';
  END IF;

  IF v_country NOT IN ('TR', 'KKTC') THEN
    RAISE EXCEPTION 'Country must be TR or KKTC';
  END IF;

  IF v_domain = '' THEN
    v_domain := v_req.request_email_domain;
  END IF;

  IF NOT (v_domain LIKE '%.edu.tr' OR v_domain LIKE '%.edu') THEN
    RAISE EXCEPTION 'Invalid university domain';
  END IF;

  INSERT INTO public.universities (name, city, type, country, created_by)
  VALUES (
    v_uni_name,
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_type, '')), ''),
    v_country,
    v_admin_id
  )
  ON CONFLICT (name) DO UPDATE
  SET
    city = COALESCE(EXCLUDED.city, public.universities.city),
    type = COALESCE(EXCLUDED.type, public.universities.type),
    country = EXCLUDED.country
  RETURNING id INTO v_university_id;

  INSERT INTO public.university_email_domains (university_id, domain, is_primary, is_verified, created_at)
  VALUES (v_university_id, v_domain, true, true, now())
  ON CONFLICT (domain) DO UPDATE
  SET
    university_id = EXCLUDED.university_id,
    is_primary = true,
    is_verified = true;

  IF p_seed_general_department THEN
    INSERT INTO public.departments (university, name, created_by)
    VALUES (v_uni_name, 'Genel', v_admin_id)
    ON CONFLICT (university, name_normalized) DO NOTHING;
  END IF;

  UPDATE public.university_domain_requests
  SET
    status = 'approved',
    admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
    reviewed_by = v_admin_id,
    reviewed_at = now(),
    resolved_university_id = v_university_id,
    resolved_domain = v_domain,
    updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'request_id', p_request_id,
    'university_id', v_university_id,
    'university_name', v_uni_name,
    'domain', v_domain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_university_by_email_domain(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_university_domain_request(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_university_domain_request(uuid, text, text, text, text, text, text, text, boolean) TO authenticated;
