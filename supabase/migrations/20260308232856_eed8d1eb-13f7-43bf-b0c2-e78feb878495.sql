
-- Re-run without the realtime line that already exists

-- Add trigger to notify followers when a user creates a new post
CREATE OR REPLACE FUNCTION public.notify_followers_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_follower record;
  v_poster_name text;
  v_type_label text;
BEGIN
  IF NEW.is_anonymous = true THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(username, 'Birisi') INTO v_poster_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  CASE NEW.content_type
    WHEN 'notes' THEN v_type_label := 'not';
    WHEN 'past_exams' THEN v_type_label := 'çıkmış soru';
    WHEN 'discussion' THEN v_type_label := 'tartışma';
    WHEN 'kaynaklar' THEN v_type_label := 'kaynak';
    ELSE v_type_label := 'içerik';
  END CASE;

  FOR v_follower IN
    SELECT follower_id FROM public.follows
    WHERE following_id = NEW.user_id AND notify_uploads = true
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_follower.follower_id,
      'follow_upload',
      'Takip ettiğiniz kullanıcı yeni ' || v_type_label || ' paylaştı',
      v_poster_name || ' yeni bir ' || v_type_label || ' ekledi: ' || LEFT(NEW.title, 50),
      '/post/' || NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_notify_followers ON public.posts;
CREATE TRIGGER on_post_notify_followers
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_on_post();

DROP TRIGGER IF EXISTS on_post_add_reputation ON public.posts;
CREATE TRIGGER on_post_add_reputation
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.add_post_reputation();

DROP TRIGGER IF EXISTS on_comment_add_reputation ON public.comments;
CREATE TRIGGER on_comment_add_reputation
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.add_comment_reputation();

DROP TRIGGER IF EXISTS on_comment_update_count ON public.comments;
CREATE TRIGGER on_comment_update_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_comment_count();

DROP TRIGGER IF EXISTS on_comment_notify ON public.comments;
CREATE TRIGGER on_comment_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS on_community_message_mention ON public.community_messages;
CREATE TRIGGER on_community_message_mention
  AFTER INSERT ON public.community_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_community_mentions();

CREATE OR REPLACE FUNCTION public.notify_post_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mention_match text;
  mentioned_user_id uuid;
  sender_name text;
  check_content text;
BEGIN
  SELECT COALESCE(username, 'Birisi') INTO sender_name FROM public.profiles WHERE user_id = NEW.user_id;
  check_content := COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.title, '');
  
  FOR mention_match IN SELECT (regexp_matches(check_content, '@(\w+)', 'g'))[1]
  LOOP
    SELECT user_id INTO mentioned_user_id FROM public.profiles WHERE username = mention_match LIMIT 1;
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (mentioned_user_id, 'mention', 'Bir gönderide etiketlendiniz', sender_name || ' sizi bir gönderide etiketledi: ' || LEFT(NEW.title, 50), '/post/' || NEW.id);
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_mention ON public.posts;
CREATE TRIGGER on_post_mention
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_mentions();

CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
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
      VALUES (mentioned_user_id, 'mention', 'Bir yorumda etiketlendiniz', sender_name || ' sizi bir yorumda etiketledi', '/post/' || NEW.post_id);
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_mention ON public.comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_mentions();

-- Enforce university lock trigger
DROP TRIGGER IF EXISTS on_profile_enforce_university ON public.profiles;
CREATE TRIGGER on_profile_enforce_university
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_university_lock();

-- Updated at trigger for profiles
DROP TRIGGER IF EXISTS on_profile_update_timestamp ON public.profiles;
CREATE TRIGGER on_profile_update_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- New user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
