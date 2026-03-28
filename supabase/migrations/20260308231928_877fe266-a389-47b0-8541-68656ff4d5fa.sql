
-- Fix user_badges insert policy to only allow authenticated users to earn badges for themselves
DROP POLICY "System can insert user badges" ON public.user_badges;
CREATE POLICY "Authenticated users can earn badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
