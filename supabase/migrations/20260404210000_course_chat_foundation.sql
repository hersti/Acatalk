-- Course chat foundation (additive)
CREATE TABLE IF NOT EXISTS public.course_chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE UNIQUE,
  last_message_at timestamptz,
  last_message_preview text,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.course_chat_rooms(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.course_chat_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.course_chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_message_id uuid REFERENCES public.course_chat_messages(id) ON DELETE SET NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  unread_count_cache integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_chat_rooms_id_course
  ON public.course_chat_rooms(id, course_id);

CREATE INDEX IF NOT EXISTS idx_course_chat_messages_course_created_at
  ON public.course_chat_messages(course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_chat_messages_room_created_at
  ON public.course_chat_messages(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_chat_messages_user_created_at
  ON public.course_chat_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_chat_reads_user
  ON public.course_chat_reads(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'course_chat_messages_room_course_fkey'
      AND conrelid = 'public.course_chat_messages'::regclass
  ) THEN
    ALTER TABLE public.course_chat_messages
      ADD CONSTRAINT course_chat_messages_room_course_fkey
      FOREIGN KEY (room_id, course_id)
      REFERENCES public.course_chat_rooms(id, course_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

-- Seed one chat room per existing course
INSERT INTO public.course_chat_rooms(course_id)
SELECT c.id
FROM public.courses c
ON CONFLICT (course_id) DO NOTHING;

-- Keep room stats updated
CREATE OR REPLACE FUNCTION public.update_course_chat_room_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid := COALESCE(NEW.room_id, OLD.room_id);
  v_last_message record;
BEGIN
  SELECT created_at, content
  INTO v_last_message
  FROM public.course_chat_messages
  WHERE room_id = v_room_id
    AND is_deleted = false
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE public.course_chat_rooms
  SET
    last_message_at = v_last_message.created_at,
    last_message_preview = LEFT(COALESCE(v_last_message.content, ''), 140),
    message_count = (
      SELECT COUNT(*)
      FROM public.course_chat_messages
      WHERE room_id = v_room_id
        AND is_deleted = false
    ),
    updated_at = now()
  WHERE id = v_room_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_chat_room_stats ON public.course_chat_messages;
CREATE TRIGGER trg_course_chat_room_stats
AFTER INSERT OR UPDATE OF content, is_deleted OR DELETE
ON public.course_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_course_chat_room_stats();

-- Ensure updated_at columns stay fresh
DROP TRIGGER IF EXISTS trg_course_chat_rooms_updated_at ON public.course_chat_rooms;
CREATE TRIGGER trg_course_chat_rooms_updated_at
BEFORE UPDATE ON public.course_chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_chat_reads_updated_at ON public.course_chat_reads;
CREATE TRIGGER trg_course_chat_reads_updated_at
BEFORE UPDATE ON public.course_chat_reads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.course_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Course chat rooms viewable by everyone" ON public.course_chat_rooms;
CREATE POLICY "Course chat rooms viewable by everyone"
  ON public.course_chat_rooms
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Course members can create rooms" ON public.course_chat_rooms;
CREATE POLICY "Course members can create rooms"
  ON public.course_chat_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.courses c ON c.id = course_chat_rooms.course_id
      WHERE p.user_id = auth.uid()
        AND p.university = c.university
    )
  );

DROP POLICY IF EXISTS "Admins can update course chat rooms" ON public.course_chat_rooms;
CREATE POLICY "Admins can update course chat rooms"
  ON public.course_chat_rooms
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Course chat messages viewable by everyone" ON public.course_chat_messages;
CREATE POLICY "Course chat messages viewable by everyone"
  ON public.course_chat_messages
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Course university members can send messages" ON public.course_chat_messages;
CREATE POLICY "Course university members can send messages"
  ON public.course_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.courses c ON c.id = course_chat_messages.course_id
      WHERE p.user_id = auth.uid()
        AND p.university = c.university
    )
  );

DROP POLICY IF EXISTS "Users can edit own chat messages" ON public.course_chat_messages;
CREATE POLICY "Users can edit own chat messages"
  ON public.course_chat_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.courses c ON c.id = course_chat_messages.course_id
        WHERE p.user_id = auth.uid()
          AND p.university = c.university
      )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Users can delete own chat messages" ON public.course_chat_messages;
CREATE POLICY "Users can delete own chat messages"
  ON public.course_chat_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own chat read states" ON public.course_chat_reads;
CREATE POLICY "Users can view own chat read states"
  ON public.course_chat_reads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own chat read states" ON public.course_chat_reads;
CREATE POLICY "Users can create own chat read states"
  ON public.course_chat_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat read states" ON public.course_chat_reads;
CREATE POLICY "Users can update own chat read states"
  ON public.course_chat_reads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'course_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.course_chat_messages;
  END IF;
END
$$;
