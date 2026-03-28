
-- Admin function to update a user's academic info (bypasses university_lock trigger)
CREATE OR REPLACE FUNCTION public.admin_update_academic_info(
  p_target_user_id uuid,
  p_university text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_class_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- First unlock
  UPDATE public.profiles
  SET university_locked = false
  WHERE user_id = p_target_user_id;

  -- Then update academic info (trigger will re-lock)
  UPDATE public.profiles
  SET
    university = COALESCE(p_university, university),
    department = COALESCE(p_department, department),
    class_year = COALESCE(p_class_year, class_year)
  WHERE user_id = p_target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
