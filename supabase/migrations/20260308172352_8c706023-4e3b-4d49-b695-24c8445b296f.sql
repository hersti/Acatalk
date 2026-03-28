
-- 1. Download tracking table to prevent spam
CREATE TABLE public.post_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.post_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view downloads" ON public.post_downloads FOR SELECT USING (true);
CREATE POLICY "Auth users can insert downloads" ON public.post_downloads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Safe download increment (once per user per post)
CREATE OR REPLACE FUNCTION public.safe_increment_download(p_post_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.post_downloads (post_id, user_id) VALUES (p_post_id, p_user_id)
  ON CONFLICT (post_id, user_id) DO NOTHING;
  IF FOUND THEN
    UPDATE public.posts SET download_count = COALESCE(download_count, 0) + 1 WHERE id = p_post_id;
    UPDATE public.profiles SET reputation_points = COALESCE(reputation_points, 0) + 1
    WHERE user_id = (SELECT user_id FROM public.posts WHERE id = p_post_id);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- 3. Add profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS class_year integer,
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

-- 4. DM request/approval: add status to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS hidden_for_user1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_for_user2 boolean NOT NULL DEFAULT false;

-- Update existing conversations to accepted
UPDATE public.conversations SET status = 'accepted' WHERE status = 'pending';

-- 5. User settings table for notification/privacy preferences
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  dm_allowed text NOT NULL DEFAULT 'everyone',
  mention_notifications boolean NOT NULL DEFAULT true,
  dm_notifications boolean NOT NULL DEFAULT true,
  reply_notifications boolean NOT NULL DEFAULT true,
  vote_notifications boolean NOT NULL DEFAULT true,
  system_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
