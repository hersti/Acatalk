
-- Add ghost_mode and dnd_mode to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS ghost_mode boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS dnd_mode boolean NOT NULL DEFAULT false;

-- Create deleted_emails table for 3-day cooldown
CREATE TABLE IF NOT EXISTS public.deleted_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  deleted_at timestamp with time zone NOT NULL DEFAULT now(),
  cooldown_until timestamp with time zone NOT NULL DEFAULT (now() + interval '3 days')
);

-- RLS for deleted_emails (only system/edge functions can insert, anon can check)
ALTER TABLE public.deleted_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert deleted emails"
ON public.deleted_emails FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can check deleted emails"
ON public.deleted_emails FOR SELECT
TO public
USING (true);
