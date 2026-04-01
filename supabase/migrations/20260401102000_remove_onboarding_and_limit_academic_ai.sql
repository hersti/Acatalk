-- Remove onboarding and lock academic_suggestions to allowed non-AI-academic types.

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS onboarding_completed;

CREATE OR REPLACE FUNCTION public.enforce_academic_suggestion_insert_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type NOT IN ('course', 'info_change') THEN
    RAISE EXCEPTION 'Only course and info_change suggestions are allowed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_academic_suggestion_insert_scope_trigger ON public.academic_suggestions;
CREATE TRIGGER enforce_academic_suggestion_insert_scope_trigger
  BEFORE INSERT ON public.academic_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_academic_suggestion_insert_scope();
