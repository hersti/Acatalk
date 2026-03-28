
-- Add 'kaynaklar' to content_type enum
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'kaynaklar';

-- Add year column to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS year integer DEFAULT 1;

-- Add is_anonymous and is_question columns to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_question boolean DEFAULT false;

-- Add reputation_points to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_points integer DEFAULT 0;

-- Create comments table for threaded discussions
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_anonymous boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create votes table for upvoting
CREATE TABLE IF NOT EXISTS public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes viewable by everyone" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote" ON public.votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own votes" ON public.votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Function to increment helpful_count
CREATE OR REPLACE FUNCTION public.increment_helpful_count(post_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts SET helpful_count = COALESCE(helpful_count, 0) + 1 WHERE id = post_id_input;
  -- Also add reputation to the post author
  UPDATE public.profiles SET reputation_points = COALESCE(reputation_points, 0) + 1
  WHERE user_id = (SELECT user_id FROM public.posts WHERE id = post_id_input);
END;
$$;

-- Function to decrement helpful_count
CREATE OR REPLACE FUNCTION public.decrement_helpful_count(post_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts SET helpful_count = GREATEST(COALESCE(helpful_count, 0) - 1, 0) WHERE id = post_id_input;
  UPDATE public.profiles SET reputation_points = GREATEST(COALESCE(reputation_points, 0) - 1, 0)
  WHERE user_id = (SELECT user_id FROM public.posts WHERE id = post_id_input);
END;
$$;

-- Add reputation for posting
CREATE OR REPLACE FUNCTION public.add_post_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET reputation_points = COALESCE(reputation_points, 0) + 5
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_post_created
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.add_post_reputation();

-- Add reputation for commenting
CREATE OR REPLACE FUNCTION public.add_comment_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET reputation_points = COALESCE(reputation_points, 0) + 2
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_comment_created
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.add_comment_reputation();
