
-- Drop triggers by their actual names on the correct tables
DROP TRIGGER IF EXISTS trg_seed_yok_courses_from_profiles ON public.profiles;
DROP TRIGGER IF EXISTS trg_seed_yok_courses_from_courses ON public.courses;
DROP TRIGGER IF EXISTS validate_post_university ON public.posts;
DROP TRIGGER IF EXISTS validate_post_university_ownership ON public.posts;

-- Drop functions with CASCADE
DROP FUNCTION IF EXISTS public.trg_seed_yok_courses_from_profiles() CASCADE;
DROP FUNCTION IF EXISTS public.trg_seed_yok_courses_from_courses() CASCADE;
DROP FUNCTION IF EXISTS public.seed_yok_common_courses_for_university(text) CASCADE;
DROP FUNCTION IF EXISTS public.seed_yok_common_courses_for_all_universities() CASCADE;
DROP FUNCTION IF EXISTS public.validate_post_university_ownership() CASCADE;

-- Drop unique index for common courses
DROP INDEX IF EXISTS public.idx_courses_unique_common_per_university;

-- Delete auto-seeded common courses and their related data
DELETE FROM public.votes WHERE post_id IN (
  SELECT p.id FROM public.posts p JOIN public.courses c ON p.course_id = c.id WHERE c.is_common = true AND c.department = 'Ortak Dersler'
);
DELETE FROM public.comments WHERE post_id IN (
  SELECT p.id FROM public.posts p JOIN public.courses c ON p.course_id = c.id WHERE c.is_common = true AND c.department = 'Ortak Dersler'
);
DELETE FROM public.bookmarks WHERE post_id IN (
  SELECT p.id FROM public.posts p JOIN public.courses c ON p.course_id = c.id WHERE c.is_common = true AND c.department = 'Ortak Dersler'
);
DELETE FROM public.post_downloads WHERE post_id IN (
  SELECT p.id FROM public.posts p JOIN public.courses c ON p.course_id = c.id WHERE c.is_common = true AND c.department = 'Ortak Dersler'
);
DELETE FROM public.posts WHERE course_id IN (
  SELECT id FROM public.courses WHERE is_common = true AND department = 'Ortak Dersler'
);
DELETE FROM public.course_resources WHERE course_id IN (
  SELECT id FROM public.courses WHERE is_common = true AND department = 'Ortak Dersler'
);
DELETE FROM public.course_wikis WHERE course_id IN (
  SELECT id FROM public.courses WHERE is_common = true AND department = 'Ortak Dersler'
);
DELETE FROM public.courses WHERE is_common = true AND department = 'Ortak Dersler';
