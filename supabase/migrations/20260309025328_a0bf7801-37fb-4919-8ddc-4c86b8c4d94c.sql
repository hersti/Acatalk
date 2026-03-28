
-- Add moderation_score to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS moderation_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS muted_until timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_until timestamp with time zone;

-- Moderation queue for flagged content
CREATE TABLE public.moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL, -- 'message', 'comment', 'post', 'image', 'profile_image'
  content_id text NOT NULL,
  content_text text,
  content_url text,
  user_id uuid NOT NULL,
  violation_type text NOT NULL, -- 'nsfw', 'toxic', 'harassment', 'hate_speech', 'threat', 'profanity'
  severity text NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  status text NOT NULL DEFAULT 'flagged', -- 'flagged', 'blocked', 'approved', 'false_positive', 'under_review'
  ai_confidence numeric,
  admin_action text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Moderation logs for audit trail
CREATE TABLE public.moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL, -- 'warning', 'mute', 'unmute', 'suspend', 'unsuspend', 'ban', 'clear_warning', 'content_deleted', 'content_approved'
  target_user_id uuid,
  content_id text,
  reason text,
  admin_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for moderation_queue
CREATE POLICY "Admins can view moderation queue" ON public.moderation_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert into moderation queue" ON public.moderation_queue
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update moderation queue" ON public.moderation_queue
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete moderation queue" ON public.moderation_queue
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for moderation_logs
CREATE POLICY "Admins can view moderation logs" ON public.moderation_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert moderation logs" ON public.moderation_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Function to increment moderation score and auto-enforce
CREATE OR REPLACE FUNCTION public.increment_moderation_score(p_user_id uuid, p_points integer, p_reason text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_score integer;
  v_action text := 'none';
BEGIN
  UPDATE public.profiles 
  SET moderation_score = COALESCE(moderation_score, 0) + p_points
  WHERE user_id = p_user_id
  RETURNING moderation_score INTO v_new_score;

  -- Auto-enforce based on thresholds
  IF v_new_score >= 20 THEN
    UPDATE public.profiles SET is_suspended = true, suspended_until = now() + interval '7 days' WHERE user_id = p_user_id;
    v_action := 'suspended';
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (p_user_id, 'moderation', 'Hesap askıya alındı', 'Tekrarlanan ihlaller nedeniyle hesabınız geçici olarak askıya alınmıştır. Admin incelemesi bekleniyor.');
  ELSIF v_new_score >= 15 THEN
    UPDATE public.profiles SET is_suspended = true, suspended_until = now() + interval '1 day' WHERE user_id = p_user_id;
    v_action := 'restricted';
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (p_user_id, 'moderation', 'Hesap kısıtlandı', 'Tekrarlanan ihlaller nedeniyle hesabınız geçici olarak kısıtlanmıştır.');
  ELSIF v_new_score >= 10 THEN
    UPDATE public.profiles SET is_muted = true, muted_until = now() + interval '6 hours' WHERE user_id = p_user_id;
    v_action := 'muted';
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (p_user_id, 'moderation', 'Sohbet engeli', 'İhlaller nedeniyle sohbet özelliğiniz geçici olarak engellenmiştir.');
  ELSIF v_new_score >= 5 THEN
    v_action := 'warning';
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (p_user_id, 'moderation', 'Uyarı', 'Platform kurallarına aykırı davranış tespit edildi. Lütfen kurallara uyun.');
  END IF;

  INSERT INTO public.moderation_logs (user_id, action, reason)
  VALUES (p_user_id, v_action, p_reason);

  RETURN jsonb_build_object('new_score', v_new_score, 'action', v_action);
END;
$$;
