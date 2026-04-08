-- Phase 1 inbox hardening:
-- 1) durable DM read state
-- 2) unread overview RPCs
-- 3) index support for messages/notifications lists

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS user1_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS user2_last_read_at timestamptz;

UPDATE public.conversations
SET
  user1_last_read_at = COALESCE(user1_last_read_at, last_message_at, created_at, now()),
  user2_last_read_at = COALESCE(user2_last_read_at, last_message_at, created_at, now());

ALTER TABLE public.conversations
  ALTER COLUMN user1_last_read_at SET DEFAULT now(),
  ALTER COLUMN user2_last_read_at SET DEFAULT now();

ALTER TABLE public.conversations
  ALTER COLUMN user1_last_read_at SET NOT NULL,
  ALTER COLUMN user2_last_read_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sender_created
ON public.messages (conversation_id, sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user1_last_message
ON public.conversations (user1_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user2_last_message
ON public.conversations (user2_id, last_message_at DESC);

CREATE OR REPLACE FUNCTION public.get_dm_unread_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total integer := 0;
  v_conversations jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'unauthenticated',
      'message', 'Authentication required.'
    );
  END IF;

  WITH scoped_conversations AS (
    SELECT
      c.id,
      CASE
        WHEN c.user1_id = v_uid THEN c.user1_last_read_at
        ELSE c.user2_last_read_at
      END AS last_read_at,
      CASE
        WHEN c.user1_id = v_uid THEN c.hidden_for_user1
        ELSE c.hidden_for_user2
      END AS hidden_for_viewer
    FROM public.conversations c
    WHERE
      (c.user1_id = v_uid OR c.user2_id = v_uid)
      AND c.status = 'accepted'
  ),
  unread_rows AS (
    SELECT
      c.id AS conversation_id,
      COUNT(m.id)::integer AS unread_count
    FROM scoped_conversations c
    LEFT JOIN public.messages m
      ON m.conversation_id = c.id
      AND m.sender_id <> v_uid
      AND m.created_at > c.last_read_at
    WHERE c.hidden_for_viewer = false
    GROUP BY c.id
  )
  SELECT
    COALESCE(SUM(unread_count), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'conversation_id', conversation_id,
          'unread_count', unread_count
        )
        ORDER BY conversation_id
      ),
      '[]'::jsonb
    )
  INTO v_total, v_conversations
  FROM unread_rows;

  RETURN jsonb_build_object(
    'ok', true,
    'total_unread', v_total,
    'conversations', v_conversations
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_dm_conversation_read(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_marked_at timestamptz := now();
  v_conversation public.conversations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'unauthenticated',
      'message', 'Authentication required.'
    );
  END IF;

  SELECT *
  INTO v_conversation
  FROM public.conversations
  WHERE
    id = p_conversation_id
    AND (user1_id = v_uid OR user2_id = v_uid)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'message', 'Conversation not found for user.'
    );
  END IF;

  IF v_conversation.user1_id = v_uid THEN
    UPDATE public.conversations
    SET user1_last_read_at = v_marked_at
    WHERE id = p_conversation_id;
  ELSE
    UPDATE public.conversations
    SET user2_last_read_at = v_marked_at
    WHERE id = p_conversation_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'conversation_id', p_conversation_id,
    'marked_at', v_marked_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dm_unread_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_dm_conversation_read(uuid) TO authenticated;
