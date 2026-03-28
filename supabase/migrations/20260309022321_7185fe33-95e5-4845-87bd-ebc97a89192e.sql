-- 1) Prevent duplicate common courses per university
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_unique_common_per_university
ON public.courses (university, name)
WHERE is_common = true;

-- 2) Idempotent seeding function for one university
CREATE OR REPLACE FUNCTION public.seed_yok_common_courses_for_university(p_university text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_university IS NULL OR btrim(p_university) = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.courses (name, code, year, university, department, is_common, description)
  VALUES
    ('Türk Dili I', 'TDL101', 1, p_university, 'Ortak Dersler', true, 'YÖK ortak dersi'),
    ('Türk Dili II', 'TDL102', 1, p_university, 'Ortak Dersler', true, 'YÖK ortak dersi'),
    ('Yabancı Dil I', 'YDL101', 1, p_university, 'Ortak Dersler', true, 'YÖK ortak dersi'),
    ('Yabancı Dil II', 'YDL102', 1, p_university, 'Ortak Dersler', true, 'YÖK ortak dersi'),
    ('Atatürk İlkeleri ve İnkılap Tarihi I', 'AIT101', 1, p_university, 'Ortak Dersler', true, 'YÖK ortak dersi'),
    ('Atatürk İlkeleri ve İnkılap Tarihi II', 'AIT102', 1, p_university, 'Ortak Dersler', true, 'YÖK ortak dersi')
  ON CONFLICT (university, name) WHERE is_common = true DO NOTHING;
END;
$$;

-- 3) Seed for all known universities in DB (profiles + courses)
CREATE OR REPLACE FUNCTION public.seed_yok_common_courses_for_all_universities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uni text;
BEGIN
  FOR v_uni IN
    SELECT university
    FROM (
      SELECT DISTINCT p.university FROM public.profiles p WHERE p.university IS NOT NULL AND btrim(p.university) <> ''
      UNION
      SELECT DISTINCT c.university FROM public.courses c WHERE c.university IS NOT NULL AND btrim(c.university) <> ''
    ) u
  LOOP
    PERFORM public.seed_yok_common_courses_for_university(v_uni);
  END LOOP;
END;
$$;

-- 4) Auto-seed when profiles get a university
CREATE OR REPLACE FUNCTION public.trg_seed_yok_courses_from_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.university IS NOT NULL AND btrim(NEW.university) <> ''
     AND (TG_OP = 'INSERT' OR NEW.university IS DISTINCT FROM OLD.university) THEN
    PERFORM public.seed_yok_common_courses_for_university(NEW.university);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_yok_courses_from_profiles ON public.profiles;
CREATE TRIGGER trg_seed_yok_courses_from_profiles
AFTER INSERT OR UPDATE OF university ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_seed_yok_courses_from_profiles();

-- 5) Auto-seed when courses introduce a new university (e.g. admin add)
CREATE OR REPLACE FUNCTION public.trg_seed_yok_courses_from_courses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.university IS NOT NULL AND btrim(NEW.university) <> ''
     AND (TG_OP = 'INSERT' OR NEW.university IS DISTINCT FROM OLD.university) THEN
    PERFORM public.seed_yok_common_courses_for_university(NEW.university);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_yok_courses_from_courses ON public.courses;
CREATE TRIGGER trg_seed_yok_courses_from_courses
AFTER INSERT OR UPDATE OF university ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.trg_seed_yok_courses_from_courses();

-- 6) Enforce post university ownership server-side
CREATE OR REPLACE FUNCTION public.validate_post_university_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_uni text;
  v_user_uni text;
BEGIN
  SELECT c.university INTO v_course_uni FROM public.courses c WHERE c.id = NEW.course_id;
  SELECT p.university INTO v_user_uni FROM public.profiles p WHERE p.user_id = NEW.user_id;

  IF v_course_uni IS NULL THEN
    RAISE EXCEPTION 'Course not found for provided course_id';
  END IF;

  IF v_user_uni IS NULL THEN
    RAISE EXCEPTION 'User university not set on profile';
  END IF;

  IF v_course_uni IS DISTINCT FROM v_user_uni THEN
    RAISE EXCEPTION 'You can only post to courses in your own university';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_post_university_ownership ON public.posts;
CREATE TRIGGER trg_validate_post_university_ownership
BEFORE INSERT OR UPDATE OF course_id, user_id ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.validate_post_university_ownership();

-- 7) Tighten RLS for post insert/update ownership check
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.courses c
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE c.id = course_id
      AND c.university = p.university
  )
);

DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
CREATE POLICY "Users can update own posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.courses c
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE c.id = course_id
      AND c.university = p.university
  )
);

-- 8) Backfill now once
SELECT public.seed_yok_common_courses_for_all_universities();