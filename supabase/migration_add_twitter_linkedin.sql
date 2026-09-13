-- ============================================================
-- Modeshare Migration: Add Twitter / X and LinkedIn Native API Support
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add provider columns to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS twitter_provider TEXT NOT NULL DEFAULT 'buffer' CHECK (twitter_provider IN ('buffer', 'twitter_api')),
  ADD COLUMN IF NOT EXISTS linkedin_provider TEXT NOT NULL DEFAULT 'buffer' CHECK (linkedin_provider IN ('buffer', 'linkedin_api'));

-- 2. Add direct post IDs and update provider check on posts table
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS twitter_post_id TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_post_id TEXT;

-- Drop previous published_provider check constraint and re-add with all 4 providers
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_published_provider_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_published_provider_check 
  CHECK (published_provider IN ('buffer', 'facebook_api', 'twitter_api', 'linkedin_api'));

-- 3. Create twitter_connections table
CREATE TABLE IF NOT EXISTS public.twitter_connections (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token        TEXT NOT NULL,
  refresh_token       TEXT,
  expires_at          TIMESTAMPTZ,
  twitter_user_id     TEXT,
  twitter_username    TEXT,
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 4. Create linkedin_connections table
CREATE TABLE IF NOT EXISTS public.linkedin_connections (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token        TEXT NOT NULL,
  refresh_token       TEXT,
  expires_at          TIMESTAMPTZ,
  account_id          TEXT NOT NULL, -- URN (e.g. urn:li:organization:123 or urn:li:person:abc)
  account_name        TEXT,
  account_type        TEXT NOT NULL DEFAULT 'organization' CHECK (account_type IN ('organization', 'person')),
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 5. Set up updated_at triggers
DROP TRIGGER IF EXISTS twitter_connections_updated_at ON public.twitter_connections;
CREATE TRIGGER twitter_connections_updated_at
  BEFORE UPDATE ON public.twitter_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS linkedin_connections_updated_at ON public.linkedin_connections;
CREATE TRIGGER linkedin_connections_updated_at
  BEFORE UPDATE ON public.linkedin_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.twitter_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

-- Twitter RLS Policies
DROP POLICY IF EXISTS "twitter_select_own" ON public.twitter_connections;
CREATE POLICY "twitter_select_own" ON public.twitter_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "twitter_select_team" ON public.twitter_connections;
CREATE POLICY "twitter_select_team" ON public.twitter_connections
  FOR SELECT USING ( public.is_admin_or_approver() );

DROP POLICY IF EXISTS "twitter_insert_own" ON public.twitter_connections;
CREATE POLICY "twitter_insert_own" ON public.twitter_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "twitter_update_own" ON public.twitter_connections;
CREATE POLICY "twitter_update_own" ON public.twitter_connections
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "twitter_delete_own" ON public.twitter_connections;
CREATE POLICY "twitter_delete_own" ON public.twitter_connections
  FOR DELETE USING (auth.uid() = user_id);

-- LinkedIn RLS Policies
DROP POLICY IF EXISTS "linkedin_select_own" ON public.linkedin_connections;
CREATE POLICY "linkedin_select_own" ON public.linkedin_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "linkedin_select_team" ON public.linkedin_connections;
CREATE POLICY "linkedin_select_team" ON public.linkedin_connections
  FOR SELECT USING ( public.is_admin_or_approver() );

DROP POLICY IF EXISTS "linkedin_insert_own" ON public.linkedin_connections;
CREATE POLICY "linkedin_insert_own" ON public.linkedin_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "linkedin_update_own" ON public.linkedin_connections;
CREATE POLICY "linkedin_update_own" ON public.linkedin_connections
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "linkedin_delete_own" ON public.linkedin_connections;
CREATE POLICY "linkedin_delete_own" ON public.linkedin_connections
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_posts_twitter_post_id ON public.posts(twitter_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_linkedin_post_id ON public.posts(linkedin_post_id);
CREATE INDEX IF NOT EXISTS idx_twitter_connections_user_id ON public.twitter_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user_id ON public.linkedin_connections(user_id);
