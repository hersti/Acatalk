
-- Add vote_type to votes table (1 = upvote, -1 = downvote)
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS vote_type integer NOT NULL DEFAULT 1;

-- Drop unique constraint and recreate with vote_type
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_user_id_post_id_key;
ALTER TABLE public.votes ADD CONSTRAINT votes_user_id_post_id_key UNIQUE (user_id, post_id);

-- Add download_count to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS download_count integer DEFAULT 0;

-- Add comment_count to posts for sorting
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0;

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes viewable by everyone" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like comments" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike comments" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add like_count to comments
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0;

-- Add onboarding_completed to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Update increment/decrement functions to support vote_type
CREATE OR REPLACE FUNCTION public.increment_helpful_count(post_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts SET helpful_count = COALESCE(helpful_count, 0) + 1 WHERE id = post_id_input;
  UPDATE public.profiles SET reputation_points = COALESCE(reputation_points, 0) + 1
  WHERE user_id = (SELECT user_id FROM public.posts WHERE id = post_id_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_helpful_count(post_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts SET helpful_count = COALESCE(helpful_count, 0) - 1 WHERE id = post_id_input;
  UPDATE public.profiles SET reputation_points = GREATEST(COALESCE(reputation_points, 0) - 1, 0)
  WHERE user_id = (SELECT user_id FROM public.posts WHERE id = post_id_input);
END;
$$;

-- Function to increment download count and add reputation
CREATE OR REPLACE FUNCTION public.increment_download_count(post_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts SET download_count = COALESCE(download_count, 0) + 1 WHERE id = post_id_input;
  UPDATE public.profiles SET reputation_points = COALESCE(reputation_points, 0) + 1
  WHERE user_id = (SELECT user_id FROM public.posts WHERE id = post_id_input);
END;
$$;

-- Function to increment comment like count
CREATE OR REPLACE FUNCTION public.increment_comment_like(comment_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.comments SET like_count = COALESCE(like_count, 0) + 1 WHERE id = comment_id_input;
  UPDATE public.profiles SET reputation_points = COALESCE(reputation_points, 0) + 1
  WHERE user_id = (SELECT user_id FROM public.comments WHERE id = comment_id_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_comment_like(comment_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.comments SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0) WHERE id = comment_id_input;
  UPDATE public.profiles SET reputation_points = GREATEST(COALESCE(reputation_points, 0) - 1, 0)
  WHERE user_id = (SELECT user_id FROM public.comments WHERE id = comment_id_input);
END;
$$;

-- Trigger to update comment_count on posts
CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_count_change ON public.comments;
CREATE TRIGGER on_comment_count_change
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();
