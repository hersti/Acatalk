
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS university_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_domain text;

CREATE OR REPLACE FUNCTION public.enforce_university_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.university_locked = true THEN
    IF NEW.university IS DISTINCT FROM OLD.university THEN
      RAISE EXCEPTION 'University cannot be changed after registration';
    END IF;
    IF NEW.department IS DISTINCT FROM OLD.department THEN
      RAISE EXCEPTION 'Department cannot be changed after registration';
    END IF;
  END IF;
  
  IF NEW.university IS NOT NULL AND NEW.department IS NOT NULL AND OLD.university_locked = false THEN
    NEW.university_locked := true;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_university_lock_trigger ON public.profiles;
CREATE TRIGGER enforce_university_lock_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_university_lock();
