-- Course Hub social trust signals v1 (additive, reliable-signal-only)
CREATE INDEX IF NOT EXISTS idx_posts_course_created_user
  ON public.posts(course_id, created_at DESC, user_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_user_created
  ON public.comments(post_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_chat_messages_course_user_created
  ON public.course_chat_messages(course_id, user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_course_social_signals_v1(
  p_course_id uuid,
  p_viewer_user_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 90));
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 5), 10));
  v_cutoff timestamptz := now() - make_interval(days => v_days);
  v_generated_at timestamptz := now();
  v_viewer_university text;
  v_viewer_department text;
  v_viewer_class_year integer;
  v_contributors jsonb := '[]'::jsonb;
  v_featured jsonb := '[]'::jsonb;
BEGIN
  IF p_viewer_user_id IS NOT NULL THEN
    SELECT p.university, p.department, p.class_year
    INTO v_viewer_university, v_viewer_department, v_viewer_class_year
    FROM public.profiles p
    WHERE p.user_id = p_viewer_user_id
    LIMIT 1;
  END IF;

  WITH post_agg AS (
    SELECT
      p.user_id,
      COUNT(*)::integer AS posts_30d,
      COALESCE(SUM(GREATEST(COALESCE(p.helpful_count, 0), 0)), 0)::integer AS helpful_positive,
      COALESCE(SUM(COALESCE(p.comment_count, 0)), 0)::integer AS post_comment_count_sum
    FROM public.posts p
    WHERE p.course_id = p_course_id
      AND p.created_at >= v_cutoff
    GROUP BY p.user_id
  ),
  comment_agg AS (
    SELECT
      c.user_id,
      COUNT(*)::integer AS comments_30d
    FROM public.comments c
    JOIN public.posts p ON p.id = c.post_id
    WHERE p.course_id = p_course_id
      AND c.created_at >= v_cutoff
    GROUP BY c.user_id
  ),
  chat_agg AS (
    SELECT
      m.user_id,
      COUNT(*)::integer AS chat_messages_30d
    FROM public.course_chat_messages m
    WHERE m.course_id = p_course_id
      AND m.is_deleted = false
      AND m.created_at >= v_cutoff
    GROUP BY m.user_id
  ),
  combined AS (
    SELECT
      COALESCE(pa.user_id, ca.user_id, cha.user_id) AS user_id,
      COALESCE(pa.posts_30d, 0) AS posts_30d,
      COALESCE(ca.comments_30d, 0) AS comments_30d,
      COALESCE(cha.chat_messages_30d, 0) AS chat_messages_30d,
      COALESCE(pa.helpful_positive, 0) AS helpful_positive,
      COALESCE(pa.post_comment_count_sum, 0) AS post_comment_count_sum
    FROM post_agg pa
    FULL OUTER JOIN comment_agg ca ON ca.user_id = pa.user_id
    FULL OUTER JOIN chat_agg cha ON cha.user_id = COALESCE(pa.user_id, ca.user_id)
  ),
  contributor_scores AS (
    SELECT
      c.user_id,
      c.posts_30d,
      c.comments_30d,
      c.chat_messages_30d,
      c.helpful_positive,
      c.post_comment_count_sum,
      ROUND((c.posts_30d * 3 + c.comments_30d * 1 + c.chat_messages_30d * 0.25)::numeric, 2) AS activity_score,
      ROUND((c.helpful_positive * 2 + c.post_comment_count_sum * 0.75)::numeric, 2) AS quality_score,
      ROUND(((c.posts_30d * 3 + c.comments_30d * 1 + c.chat_messages_30d * 0.25) * 0.4 + (c.helpful_positive * 2 + c.post_comment_count_sum * 0.75) * 0.6)::numeric, 2) AS course_reputation_v1
    FROM combined c
  ),
  contributor_with_profiles AS (
    SELECT
      s.user_id,
      COALESCE(p.username, 'kullanici') AS username,
      COALESCE(NULLIF(TRIM(p.display_name), ''), p.username, 'Kullanici') AS display_name,
      p.avatar_url,
      p.university,
      p.department,
      p.class_year,
      s.posts_30d,
      s.comments_30d,
      s.chat_messages_30d,
      s.helpful_positive,
      s.post_comment_count_sum,
      s.activity_score,
      s.quality_score,
      s.course_reputation_v1,
      (v_viewer_university IS NOT NULL AND p.university IS NOT NULL AND p.university = v_viewer_university) AS same_university,
      (v_viewer_department IS NOT NULL AND p.department IS NOT NULL AND p.department = v_viewer_department) AS same_department,
      (v_viewer_class_year IS NOT NULL AND p.class_year IS NOT NULL AND p.class_year = v_viewer_class_year) AS same_class_year
    FROM contributor_scores s
    LEFT JOIN public.profiles p ON p.user_id = s.user_id
    ORDER BY s.course_reputation_v1 DESC, s.activity_score DESC, s.helpful_positive DESC, s.user_id
    LIMIT v_limit
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', c.user_id,
        'username', c.username,
        'display_name', c.display_name,
        'avatar_url', c.avatar_url,
        'university', c.university,
        'department', c.department,
        'class_year', c.class_year,
        'posts_30d', c.posts_30d,
        'comments_30d', c.comments_30d,
        'chat_messages_30d', c.chat_messages_30d,
        'helpful_positive', c.helpful_positive,
        'post_comment_count_sum', c.post_comment_count_sum,
        'activity_score', c.activity_score,
        'quality_score', c.quality_score,
        'course_reputation_v1', c.course_reputation_v1,
        'same_university', c.same_university,
        'same_department', c.same_department,
        'same_class_year', c.same_class_year
      )
      ORDER BY c.course_reputation_v1 DESC, c.activity_score DESC, c.helpful_positive DESC
    ),
    '[]'::jsonb
  )
  INTO v_contributors
  FROM contributor_with_profiles c;

  WITH featured_posts AS (
    SELECT
      p.id,
      p.user_id,
      p.title,
      p.content_type,
      p.created_at,
      COALESCE(p.helpful_count, 0)::integer AS helpful_count,
      COALESCE(p.comment_count, 0)::integer AS comment_count,
      ROUND((
        GREATEST(COALESCE(p.helpful_count, 0), 0) * 3
        + COALESCE(p.comment_count, 0) * 1.5
        + LEAST(2.0, GREATEST(0.0, 2.0 - (EXTRACT(EPOCH FROM (v_generated_at - p.created_at)) / 86400.0) * 0.12))
      )::numeric, 2) AS featured_v1
    FROM public.posts p
    WHERE p.course_id = p_course_id
    ORDER BY featured_v1 DESC, p.created_at DESC
    LIMIT v_limit
  ),
  featured_with_profiles AS (
    SELECT
      fp.id,
      fp.title,
      fp.content_type,
      fp.created_at,
      fp.helpful_count,
      fp.comment_count,
      fp.featured_v1,
      fp.user_id,
      COALESCE(pr.username, 'kullanici') AS username,
      COALESCE(NULLIF(TRIM(pr.display_name), ''), pr.username, 'Kullanici') AS display_name,
      pr.avatar_url,
      pr.university,
      pr.department,
      pr.class_year,
      (v_viewer_university IS NOT NULL AND pr.university IS NOT NULL AND pr.university = v_viewer_university) AS same_university,
      (v_viewer_department IS NOT NULL AND pr.department IS NOT NULL AND pr.department = v_viewer_department) AS same_department,
      (v_viewer_class_year IS NOT NULL AND pr.class_year IS NOT NULL AND pr.class_year = v_viewer_class_year) AS same_class_year
    FROM featured_posts fp
    LEFT JOIN public.profiles pr ON pr.user_id = fp.user_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'post_id', f.id,
        'title', f.title,
        'content_type', f.content_type,
        'created_at', f.created_at,
        'helpful_count', f.helpful_count,
        'comment_count', f.comment_count,
        'featured_v1', f.featured_v1,
        'author_user_id', f.user_id,
        'author_username', f.username,
        'author_display_name', f.display_name,
        'author_avatar_url', f.avatar_url,
        'author_university', f.university,
        'author_department', f.department,
        'author_class_year', f.class_year,
        'same_university', f.same_university,
        'same_department', f.same_department,
        'same_class_year', f.same_class_year
      )
      ORDER BY f.featured_v1 DESC, f.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_featured
  FROM featured_with_profiles f;

  RETURN jsonb_build_object(
    'course_id', p_course_id,
    'window_days', v_days,
    'contributors', v_contributors,
    'featured_content', v_featured,
    'generated_at', v_generated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_social_signals_v1(uuid, uuid, integer, integer) TO anon, authenticated;
