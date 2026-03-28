
-- Attach all missing triggers

-- 1. Reputation triggers
CREATE TRIGGER trg_add_post_reputation
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.add_post_reputation();

CREATE TRIGGER trg_add_comment_reputation
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.add_comment_reputation();

-- 2. Comment count trigger
CREATE TRIGGER trg_update_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();

-- 3. Notification triggers
CREATE TRIGGER trg_notify_followers_on_post
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_post();

CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE TRIGGER trg_notify_post_mentions
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_mentions();

CREATE TRIGGER trg_notify_comment_mentions
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_mentions();

CREATE TRIGGER trg_notify_community_mentions
  AFTER INSERT ON public.community_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_mentions();

-- 4. Profile updated_at trigger
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. University lock trigger
CREATE TRIGGER trg_enforce_university_lock
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_university_lock();

-- 6. Posts updated_at trigger
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
