-- Feed snapshot v1 runtime fix: keep scored CTE scope in a single SQL statement

CREATE OR REPLACE FUNCTION public.get_feed_snapshot_v1(
  p_limit_courses integer DEFAULT 8,
  p_limit_posts integer DEFAULT 8,
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit_courses integer := GREATEST(1, LEAST(COALESCE(p_limit_courses, 8), 20));
  v_limit_posts integer := GREATEST(1, LEAST(COALESCE(p_limit_posts, 8), 20));
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 90));
  v_now timestamptz := now();
  v_generated_at timestamptz := now();
  v_viewer_university text := NULL;
  v_viewer_department text := NULL;
  v_viewer_class_year integer := NULL;
  v_recommended jsonb := '[]'::jsonb;
  v_resume jsonb := '[]'::jsonb;
  v_active jsonb := '[]'::jsonb;
  v_posts jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT p.university, p.department, p.class_year
    INTO v_viewer_university, v_viewer_department, v_viewer_class_year
    FROM public.profiles p
    WHERE p.user_id = v_user_id
    LIMIT 1;
  END IF;

  WITH course_counts AS (
    SELECT
      p.course_id,
      COUNT(*) FILTER (WHERE p.status = 'published' AND p.content_type = 'notes')::integer AS notes_count,
      COUNT(*) FILTER (WHERE p.status = 'published' AND p.content_type = 'past_exams')::integer AS past_exams_count,
      COUNT(*) FILTER (WHERE p.status = 'published' AND p.content_type = 'discussion')::integer AS discussion_count,
      COUNT(*) FILTER (WHERE p.status = 'published' AND p.content_type = 'kaynaklar')::integer AS kaynaklar_count
    FROM public.posts p
    GROUP BY p.course_id
  ),
  post_agg AS (
    SELECT
      p.course_id,
      COUNT(*) FILTER (WHERE p.status = 'published' AND p.created_at >= v_now - interval '14 days')::integer AS published_posts_14d,
      COUNT(*) FILTER (WHERE p.status = 'published' AND p.created_at >= v_now - interval '30 days')::integer AS published_posts_30d,
      COALESCE(SUM(GREATEST(COALESCE(p.helpful_count, 0), 0)) FILTER (WHERE p.status = 'published' AND p.created_at >= v_now - interval '30 days'), 0)::integer AS helpful_sum_30d,
      COUNT(*) FILTER (WHERE p.status = 'published' AND COALESCE(p.comment_count, 0) > 0 AND p.created_at >= v_now - interval '30 days')::integer AS commented_posts_30d,
      MAX(p.created_at) FILTER (WHERE p.status = 'published') AS last_post_at
    FROM public.posts p
    GROUP BY p.course_id
  ),
  chat_agg AS (
    SELECT
      m.course_id,
      COUNT(*) FILTER (WHERE m.is_deleted = false AND m.created_at >= v_now - interval '7 days')::integer AS chat_messages_7d,
      COUNT(*) FILTER (WHERE m.is_deleted = false AND m.created_at >= v_now - interval '14 days')::integer AS chat_messages_14d,
      MAX(m.created_at) FILTER (WHERE m.is_deleted = false) AS last_chat_at
    FROM public.course_chat_messages m
    GROUP BY m.course_id
  ),
  post_contrib AS (
    SELECT p.course_id, p.user_id
    FROM public.posts p
    WHERE p.status = 'published'
      AND p.created_at >= v_now - interval '14 days'
    GROUP BY p.course_id, p.user_id
  ),
  chat_contrib AS (
    SELECT m.course_id, m.user_id
    FROM public.course_chat_messages m
    WHERE m.is_deleted = false
      AND m.created_at >= v_now - interval '14 days'
    GROUP BY m.course_id, m.user_id
  ),
  contrib_agg AS (
    SELECT u.course_id, COUNT(DISTINCT u.user_id)::integer AS active_contributors_14d
    FROM (
      SELECT * FROM post_contrib
      UNION
      SELECT * FROM chat_contrib
    ) u
    GROUP BY u.course_id
  ),
  visits AS (
    SELECT
      v.course_id,
      v.last_visited_at,
      v.visit_count,
      v.last_source,
      CASE
        WHEN v.last_visited_at >= v_now - interval '1 day' THEN 3.0
        WHEN v.last_visited_at >= v_now - interval '7 days' THEN 2.0
        WHEN v.last_visited_at >= v_now - interval '30 days' THEN 1.0
        ELSE 0.0
      END AS recent_visit_weight
    FROM public.user_course_visits v
    WHERE v.user_id = v_user_id
  ),
  scored AS (
    SELECT
      c.id AS course_id,
      c.name,
      c.code,
      c.department,
      c.university,
      c.year,
      COALESCE(cc.notes_count, 0) AS notes_count,
      COALESCE(cc.past_exams_count, 0) AS past_exams_count,
      COALESCE(cc.discussion_count, 0) AS discussion_count,
      COALESCE(cc.kaynaklar_count, 0) AS kaynaklar_count,
      COALESCE(pa.published_posts_14d, 0) AS published_posts_14d,
      COALESCE(pa.published_posts_30d, 0) AS published_posts_30d,
      COALESCE(pa.helpful_sum_30d, 0) AS helpful_sum_30d,
      COALESCE(pa.commented_posts_30d, 0) AS commented_posts_30d,
      COALESCE(ca.chat_messages_7d, 0) AS chat_messages_7d,
      COALESCE(coa.active_contributors_14d, 0) AS active_contributors_14d,
      GREATEST(COALESCE(pa.last_post_at, 'epoch'::timestamptz), COALESCE(ca.last_chat_at, 'epoch'::timestamptz)) AS last_activity_at,
      COALESCE(v.last_visited_at, NULL) AS last_visited_at,
      COALESCE(v.visit_count, 0) AS visit_count,
      COALESCE(v.last_source, NULL) AS last_source,
      (
        (CASE WHEN v_viewer_university IS NOT NULL AND c.university = v_viewer_university THEN 5 ELSE 0 END) +
        (CASE WHEN v_viewer_department IS NOT NULL AND c.department = v_viewer_department THEN 3 ELSE 0 END) +
        (CASE WHEN v_viewer_class_year IS NOT NULL AND c.year = v_viewer_class_year THEN 2 ELSE 0 END)
      )::numeric AS fit_score,
      (COALESCE(pa.published_posts_14d, 0) * 2 + COALESCE(ca.chat_messages_7d, 0) * 1 + COALESCE(coa.active_contributors_14d, 0) * 1.5)::numeric AS activity_score,
      (COALESCE(pa.helpful_sum_30d, 0) * 1.5 + COALESCE(pa.commented_posts_30d, 0) * 1)::numeric AS quality_score,
      COALESCE(v.recent_visit_weight, 0)::numeric AS resume_boost
    FROM public.courses c
    LEFT JOIN course_counts cc ON cc.course_id = c.id
    LEFT JOIN post_agg pa ON pa.course_id = c.id
    LEFT JOIN chat_agg ca ON ca.course_id = c.id
    LEFT JOIN contrib_agg coa ON coa.course_id = c.id
    LEFT JOIN visits v ON v.course_id = c.id
  ),
  scored_with_total AS (
    SELECT
      s.*,
      ROUND((s.fit_score * 0.45 + s.activity_score * 0.30 + s.quality_score * 0.20 + s.resume_boost * 0.05)::numeric, 2) AS total_score
    FROM scored s
  )
  SELECT
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'course_id', r.course_id,
            'name', r.name,
            'code', r.code,
            'department', r.department,
            'university', r.university,
            'year', r.year,
            'notes_count', r.notes_count,
            'past_exams_count', r.past_exams_count,
            'discussion_count', r.discussion_count,
            'kaynaklar_count', r.kaynaklar_count,
            'published_posts_14d', r.published_posts_14d,
            'published_posts_30d', r.published_posts_30d,
            'helpful_sum_30d', r.helpful_sum_30d,
            'commented_posts_30d', r.commented_posts_30d,
            'chat_messages_7d', r.chat_messages_7d,
            'active_contributors_14d', r.active_contributors_14d,
            'last_activity_at', NULLIF(r.last_activity_at, 'epoch'::timestamptz),
            'fit_score', ROUND(r.fit_score, 2),
            'activity_score', ROUND(r.activity_score, 2),
            'quality_score', ROUND(r.quality_score, 2),
            'resume_boost', ROUND(r.resume_boost, 2),
            'total_score', r.total_score
          )
          ORDER BY r.total_score DESC, r.last_activity_at DESC NULLS LAST
        )
        FROM (
          SELECT *
          FROM scored_with_total
          ORDER BY total_score DESC, last_activity_at DESC NULLS LAST
          LIMIT v_limit_courses
        ) r
      ),
      '[]'::jsonb
    ),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'course_id', r.course_id,
            'name', r.name,
            'code', r.code,
            'department', r.department,
            'university', r.university,
            'year', r.year,
            'notes_count', r.notes_count,
            'past_exams_count', r.past_exams_count,
            'discussion_count', r.discussion_count,
            'kaynaklar_count', r.kaynaklar_count,
            'published_posts_14d', r.published_posts_14d,
            'chat_messages_7d', r.chat_messages_7d,
            'active_contributors_14d', r.active_contributors_14d,
            'last_activity_at', NULLIF(r.last_activity_at, 'epoch'::timestamptz),
            'last_visited_at', r.last_visited_at,
            'visit_count', r.visit_count,
            'last_source', r.last_source
          )
          ORDER BY r.last_visited_at DESC NULLS LAST
        )
        FROM (
          SELECT *
          FROM scored_with_total
          WHERE last_visited_at IS NOT NULL
          ORDER BY last_visited_at DESC
          LIMIT v_limit_courses
        ) r
      ),
      '[]'::jsonb
    ),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'course_id', r.course_id,
            'name', r.name,
            'code', r.code,
            'department', r.department,
            'university', r.university,
            'year', r.year,
            'notes_count', r.notes_count,
            'past_exams_count', r.past_exams_count,
            'discussion_count', r.discussion_count,
            'kaynaklar_count', r.kaynaklar_count,
            'published_posts_14d', r.published_posts_14d,
            'chat_messages_7d', r.chat_messages_7d,
            'active_contributors_14d', r.active_contributors_14d,
            'helpful_sum_30d', r.helpful_sum_30d,
            'last_activity_at', NULLIF(r.last_activity_at, 'epoch'::timestamptz),
            'activity_score', ROUND(r.activity_score, 2),
            'quality_score', ROUND(r.quality_score, 2)
          )
          ORDER BY r.activity_score DESC, r.quality_score DESC, r.last_activity_at DESC NULLS LAST
        )
        FROM (
          SELECT *
          FROM scored_with_total
          ORDER BY activity_score DESC, quality_score DESC, last_activity_at DESC NULLS LAST
          LIMIT v_limit_courses
        ) r
      ),
      '[]'::jsonb
    )
  INTO v_recommended, v_resume, v_active;

  WITH useful AS (
    SELECT
      p.id AS post_id,
      p.course_id,
      c.name AS course_name,
      c.code AS course_code,
      p.title,
      p.content_type,
      p.created_at,
      COALESCE(p.helpful_count, 0)::integer AS helpful_count,
      COALESCE(p.comment_count, 0)::integer AS comment_count,
      p.user_id AS author_user_id,
      COALESCE(pr.username, 'kullanici') AS author_username,
      COALESCE(NULLIF(TRIM(pr.display_name), ''), pr.username, 'Kullanici') AS author_display_name,
      pr.avatar_url AS author_avatar_url,
      (v_viewer_university IS NOT NULL AND pr.university IS NOT NULL AND pr.university = v_viewer_university) AS same_university,
      (v_viewer_department IS NOT NULL AND pr.department IS NOT NULL AND pr.department = v_viewer_department) AS same_department,
      ROUND((
        GREATEST(COALESCE(p.helpful_count, 0), 0) * 3
        + COALESCE(p.comment_count, 0) * 1.5
        + LEAST(2.0, GREATEST(0.0, 2.0 - (EXTRACT(EPOCH FROM (v_generated_at - p.created_at)) / 86400.0) * 0.12))
        + CASE WHEN v_viewer_university IS NOT NULL AND c.university = v_viewer_university THEN 0.6 ELSE 0 END
        + CASE WHEN v_viewer_department IS NOT NULL AND c.department = v_viewer_department THEN 0.4 ELSE 0 END
      )::numeric, 2) AS featured_score
    FROM public.posts p
    JOIN public.courses c ON c.id = p.course_id
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.status = 'published'
      AND p.created_at >= v_now - make_interval(days => v_days)
    ORDER BY featured_score DESC, p.created_at DESC
    LIMIT v_limit_posts
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'post_id', u.post_id,
        'course_id', u.course_id,
        'course_name', u.course_name,
        'course_code', u.course_code,
        'title', u.title,
        'content_type', u.content_type,
        'created_at', u.created_at,
        'helpful_count', u.helpful_count,
        'comment_count', u.comment_count,
        'featured_score', u.featured_score,
        'author_user_id', u.author_user_id,
        'author_username', u.author_username,
        'author_display_name', u.author_display_name,
        'author_avatar_url', u.author_avatar_url,
        'same_university', u.same_university,
        'same_department', u.same_department
      )
      ORDER BY u.featured_score DESC, u.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_posts
  FROM useful u;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'recommended_courses', v_recommended,
    'resume_courses', v_resume,
    'active_courses', v_active,
    'useful_posts', v_posts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_feed_snapshot_v1(integer, integer, integer) TO anon, authenticated;
