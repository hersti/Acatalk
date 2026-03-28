
-- Bookmarks table
CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Trigger: notify on new comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_post_owner uuid;
  v_post_title text;
  v_commenter_name text;
BEGIN
  SELECT user_id, title INTO v_post_owner, v_post_title FROM public.posts WHERE id = NEW.post_id;
  SELECT COALESCE(username, 'Birisi') INTO v_commenter_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  IF v_post_owner IS NOT NULL AND v_post_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_post_owner, 'reply', 'Yeni yanıt', v_commenter_name || ' gönderinize yanıt verdi: ' || LEFT(v_post_title, 50), '/post/' || NEW.post_id);
  END IF;
  
  -- Notify parent comment author for threaded replies
  IF NEW.parent_id IS NOT NULL THEN
    DECLARE v_parent_owner uuid;
    BEGIN
      SELECT user_id INTO v_parent_owner FROM public.comments WHERE id = NEW.parent_id;
      IF v_parent_owner IS NOT NULL AND v_parent_owner != NEW.user_id AND v_parent_owner != v_post_owner THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (v_parent_owner, 'reply', 'Yanıtınıza cevap', v_commenter_name || ' yanıtınıza cevap verdi', '/post/' || NEW.post_id);
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();
