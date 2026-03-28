
-- Add discussion-specific columns to posts
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS discussion_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_solved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS solved_comment_id uuid DEFAULT NULL;

-- Add foreign key for solved_comment_id
ALTER TABLE public.posts 
  ADD CONSTRAINT posts_solved_comment_id_fkey 
  FOREIGN KEY (solved_comment_id) REFERENCES public.comments(id) ON DELETE SET NULL;

-- Allow admins to update any post (for pinning)
CREATE POLICY "Admins can update any post"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
