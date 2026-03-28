
-- Add UPDATE policy on votes table (needed for switching vote direction)
CREATE POLICY "Users can update own votes"
ON public.votes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create atomic handle_vote function that handles all voting logic in one transaction
CREATE OR REPLACE FUNCTION public.handle_vote(p_post_id uuid, p_user_id uuid, p_direction integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_type integer;
  v_post_owner_id uuid;
  v_new_helpful integer;
BEGIN
  -- Get post owner
  SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = p_post_id;
  IF v_post_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Post not found');
  END IF;

  -- Check existing vote
  SELECT id, vote_type INTO v_existing_id, v_existing_type
  FROM public.votes
  WHERE post_id = p_post_id AND user_id = p_user_id;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_type = p_direction THEN
      -- Same direction: remove vote
      DELETE FROM public.votes WHERE id = v_existing_id;
      UPDATE public.posts SET helpful_count = COALESCE(helpful_count, 0) - p_direction WHERE id = p_post_id;
      -- Remove reputation
      UPDATE public.profiles SET reputation_points = GREATEST(COALESCE(reputation_points, 0) - 1, 0)
      WHERE user_id = v_post_owner_id;
    ELSE
      -- Opposite direction: switch vote (delta is 2x direction)
      UPDATE public.votes SET vote_type = p_direction WHERE id = v_existing_id;
      UPDATE public.posts SET helpful_count = COALESCE(helpful_count, 0) + (2 * p_direction) WHERE id = p_post_id;
      -- Net reputation change: remove old rep, add new rep (net 0 if switching, but we keep it simple)
      -- Old vote gave rep, new vote gives rep, so net is 0 change for reputation
    END IF;
  ELSE
    -- New vote
    INSERT INTO public.votes (post_id, user_id, vote_type) VALUES (p_post_id, p_user_id, p_direction);
    UPDATE public.posts SET helpful_count = COALESCE(helpful_count, 0) + p_direction WHERE id = p_post_id;
    -- Add reputation for upvotes only
    IF p_direction = 1 THEN
      UPDATE public.profiles SET reputation_points = COALESCE(reputation_points, 0) + 1
      WHERE user_id = v_post_owner_id;
    END IF;
  END IF;

  -- Return the new helpful_count and user's current vote
  SELECT helpful_count INTO v_new_helpful FROM public.posts WHERE id = p_post_id;
  
  SELECT vote_type INTO v_existing_type FROM public.votes WHERE post_id = p_post_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'helpful_count', COALESCE(v_new_helpful, 0),
    'user_vote', COALESCE(v_existing_type, 0)
  );
END;
$$;
