
CREATE OR REPLACE FUNCTION public.increment_moderation_score(p_user_id uuid, p_points integer, p_reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_score integer;
  v_action text := 'none';
  v_old_muted boolean;
  v_old_suspended boolean;
BEGIN
  -- First, auto-clear expired penalties
  UPDATE public.profiles 
  SET 
    is_muted = CASE WHEN is_muted AND muted_until IS NOT NULL AND muted_until <= now() THEN false ELSE is_muted END,
    muted_until = CASE WHEN is_muted AND muted_until IS NOT NULL AND muted_until <= now() THEN NULL ELSE muted_until END,
    is_suspended = CASE WHEN is_suspended AND suspended_until IS NOT NULL AND suspended_until <= now() THEN false ELSE is_suspended END,
    suspended_until = CASE WHEN is_suspended AND suspended_until IS NOT NULL AND suspended_until <= now() THEN NULL ELSE suspended_until END
  WHERE user_id = p_user_id;

  -- Increment score
  UPDATE public.profiles 
  SET moderation_score = COALESCE(moderation_score, 0) + p_points
  WHERE user_id = p_user_id
  RETURNING moderation_score, is_muted, is_suspended INTO v_new_score, v_old_muted, v_old_suspended;

  -- Auto-enforce based on thresholds (progressive penalties)
  IF v_new_score >= 25 THEN
    -- Permanent suspension review
    IF NOT v_old_suspended THEN
      UPDATE public.profiles SET is_suspended = true, suspended_until = now() + interval '30 days' WHERE user_id = p_user_id;
      v_action := 'permanent_review';
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (p_user_id, 'moderation', 'Hesap askıya alındı', 'Ciddi ve tekrarlanan ihlaller nedeniyle hesabınız 30 gün süreyle askıya alınmıştır. Durum admin tarafından incelenecektir.');
    END IF;
  ELSIF v_new_score >= 20 THEN
    -- 7-day suspension
    IF NOT v_old_suspended THEN
      UPDATE public.profiles SET is_suspended = true, suspended_until = now() + interval '7 days' WHERE user_id = p_user_id;
      v_action := 'suspended_7d';
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (p_user_id, 'moderation', 'Hesap 7 gün askıya alındı', 'Tekrarlanan ihlaller nedeniyle hesabınız 7 gün süreyle askıya alınmıştır.');
    END IF;
  ELSIF v_new_score >= 15 THEN
    -- 24-hour suspension
    IF NOT v_old_suspended THEN
      UPDATE public.profiles SET is_suspended = true, suspended_until = now() + interval '1 day' WHERE user_id = p_user_id;
      v_action := 'suspended_1d';
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (p_user_id, 'moderation', 'Hesap 24 saat askıya alındı', 'Tekrarlanan ihlaller nedeniyle hesabınız geçici olarak askıya alınmıştır.');
    END IF;
  ELSIF v_new_score >= 10 THEN
    -- 6-hour mute
    IF NOT v_old_muted THEN
      UPDATE public.profiles SET is_muted = true, muted_until = now() + interval '6 hours' WHERE user_id = p_user_id;
      v_action := 'muted_6h';
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (p_user_id, 'moderation', 'Sohbet engeli (6 saat)', 'İhlaller nedeniyle sohbet özelliğiniz 6 saat süreyle engellenmiştir.');
    END IF;
  ELSIF v_new_score >= 7 THEN
    -- 1-hour mute
    IF NOT v_old_muted THEN
      UPDATE public.profiles SET is_muted = true, muted_until = now() + interval '1 hour' WHERE user_id = p_user_id;
      v_action := 'muted_1h';
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (p_user_id, 'moderation', 'Sohbet engeli (1 saat)', 'İhlaller nedeniyle sohbet özelliğiniz 1 saat süreyle engellenmiştir.');
    END IF;
  ELSIF v_new_score >= 5 THEN
    -- Warning only
    v_action := 'warning';
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (p_user_id, 'moderation', 'Uyarı', 'Platform kurallarına aykırı davranış tespit edildi. Devam eden ihlaller hesabınızın kısıtlanmasına yol açacaktır.');
  ELSIF v_new_score >= 3 THEN
    -- Soft warning
    v_action := 'soft_warning';
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (p_user_id, 'moderation', 'Dikkat', 'İçeriğiniz platform kurallarına aykırı bulundu. Lütfen topluluk kurallarına uyun.');
  END IF;

  -- Log the action
  INSERT INTO public.moderation_logs (user_id, action, reason)
  VALUES (p_user_id, v_action, p_reason);

  RETURN jsonb_build_object('new_score', v_new_score, 'action', v_action);
END;
$function$;

-- Create a function to auto-clear expired moderation penalties
CREATE OR REPLACE FUNCTION public.auto_clear_expired_penalties()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles 
  SET 
    is_muted = false,
    muted_until = NULL
  WHERE is_muted = true AND muted_until IS NOT NULL AND muted_until <= now();

  UPDATE public.profiles 
  SET 
    is_suspended = false,
    suspended_until = NULL
  WHERE is_suspended = true AND suspended_until IS NOT NULL AND suspended_until <= now();
END;
$function$;
