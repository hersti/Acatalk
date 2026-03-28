
-- Badge definitions table
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'contribution',
  icon text NOT NULL DEFAULT 'award',
  threshold integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User badges (earned)
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Follow/connection system
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  notify_uploads boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Connection requests (for DM access)
CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  target_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(requester_id, target_id)
);

-- University chat messages
CREATE TABLE public.university_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university text NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable realtime for university messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.university_messages;

-- RLS for badges
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges viewable by everyone" ON public.badges FOR SELECT USING (true);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User badges viewable by everyone" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "System can insert user badges" ON public.user_badges FOR INSERT WITH CHECK (true);

-- RLS for follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);
CREATE POLICY "Users can update follow settings" ON public.follows FOR UPDATE USING (auth.uid() = follower_id);

-- RLS for connections
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own connections" ON public.connections FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_id);
CREATE POLICY "Users can request connections" ON public.connections FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can respond to connections" ON public.connections FOR UPDATE USING (auth.uid() = target_id OR auth.uid() = requester_id);

-- RLS for university messages
ALTER TABLE public.university_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "University members can view messages" ON public.university_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND university = university_messages.university)
);
CREATE POLICY "University members can send messages" ON public.university_messages FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND university = university_messages.university)
);

-- Seed badge definitions
INSERT INTO public.badges (key, name, description, category, icon, threshold) VALUES
  ('first_upload', 'İlk Yükleme', 'İlk içeriğini paylaştı', 'contribution', 'upload', 1),
  ('first_discussion', 'İlk Tartışma', 'İlk tartışmayı başlattı', 'contribution', 'message-square', 1),
  ('first_answer', 'İlk Cevap', 'İlk yorum/cevabı yazdı', 'contribution', 'check-circle', 1),
  ('helpful_5', 'Yardımsever', '5 faydalı oy aldı', 'contribution', 'thumbs-up', 5),
  ('top_contributor', 'En İyi Katkıcı', '50 içerik paylaştı', 'contribution', 'trophy', 50),
  ('active_member', 'Aktif Üye', '30 gün boyunca aktif', 'community', 'activity', 30),
  ('discussion_starter', 'Tartışma Başlatıcı', '10 tartışma açtı', 'community', 'message-circle', 10),
  ('mentor', 'Mentor', '25 kabul edilen cevap', 'community', 'award', 25),
  ('exam_uploader', 'Sınav Paylaşıcı', '5 çıkmış soru paylaştı', 'academic', 'file-text', 5),
  ('notes_contributor', 'Not Katkıcısı', '10 not paylaştı', 'academic', 'book-open', 10),
  ('resource_curator', 'Kaynak Küratörü', '5 kaynak paylaştı', 'academic', 'bookmark', 5);
