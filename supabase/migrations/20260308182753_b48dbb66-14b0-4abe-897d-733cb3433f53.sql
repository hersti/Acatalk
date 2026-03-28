
-- Add blocked_users table for DM blocking
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocks" ON public.blocked_users
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks" ON public.blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks" ON public.blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);

-- Add rejected_at to conversations for cooldown tracking
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Create mention notification trigger for community messages
CREATE OR REPLACE FUNCTION public.notify_community_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mention_match text;
  mentioned_user_id uuid;
  sender_name text;
BEGIN
  SELECT COALESCE(username, 'Birisi') INTO sender_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  FOR mention_match IN SELECT (regexp_matches(NEW.content, '@(\w+)', 'g'))[1]
  LOOP
    SELECT user_id INTO mentioned_user_id FROM public.profiles WHERE username = mention_match LIMIT 1;
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (mentioned_user_id, 'mention', 'Topluluk sohbetinde bahsedildiniz', sender_name || ' sizi topluluk sohbetinde etiketledi', '/community');
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_mention_trigger ON public.community_messages;
CREATE TRIGGER community_mention_trigger
  AFTER INSERT ON public.community_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_mentions();
