-- ============================================================
-- Modeshare Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'creator' CHECK (role IN ('creator', 'approver', 'admin', 'super_admin')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BRIEFS (user-submitted content requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.briefs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic         TEXT NOT NULL,
  description   TEXT,
  tone          TEXT NOT NULL DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'witty', 'informative', 'inspirational')),
  platforms     TEXT[] NOT NULL DEFAULT '{}',  -- ['facebook', 'twitter', 'linkedin']
  target_date   DATE,
  status        TEXT NOT NULL DEFAULT 'pending_generation' CHECK (status IN ('pending_generation', 'generated', 'in_review', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GENERATED POSTS (AI-generated post variants per platform)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brief_id        UUID NOT NULL REFERENCES public.briefs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('facebook', 'twitter', 'linkedin')),
  variant_index   INTEGER NOT NULL DEFAULT 1 CHECK (variant_index BETWEEN 1 AND 3),
  content         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'scheduled', 'published')),
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  reviewer_note   TEXT,
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  buffer_post_id  TEXT,   -- ID returned by Buffer after scheduling
  metrics         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUFFER CONNECTIONS (store Buffer access tokens per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.buffer_connections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL,
  profile_ids     JSONB NOT NULL DEFAULT '{}',  -- { facebook: "id", twitter: "id", linkedin: "id" }
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS briefs_updated_at ON public.briefs;
CREATE TRIGGER briefs_updated_at
  BEFORE UPDATE ON public.briefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS posts_updated_at ON public.posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS buffer_connections_updated_at ON public.buffer_connections;
CREATE TRIGGER buffer_connections_updated_at
  BEFORE UPDATE ON public.buffer_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buffer_connections ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER Helper to check roles without infinite RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin_or_approver()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('approver', 'admin', 'super_admin')
  );
END;
$$;

-- Profiles: users see their own, admins/approvers see all
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_team" ON public.profiles;
CREATE POLICY "profiles_select_team" ON public.profiles
  FOR SELECT USING ( public.is_admin_or_approver() );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Briefs: creators see their own, approvers/admins see all
DROP POLICY IF EXISTS "briefs_select_own" ON public.briefs;
CREATE POLICY "briefs_select_own" ON public.briefs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "briefs_select_approver" ON public.briefs;
CREATE POLICY "briefs_select_approver" ON public.briefs
  FOR SELECT USING ( public.is_admin_or_approver() );

DROP POLICY IF EXISTS "briefs_insert_own" ON public.briefs;
CREATE POLICY "briefs_insert_own" ON public.briefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "briefs_update_own" ON public.briefs;
CREATE POLICY "briefs_update_own" ON public.briefs
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "briefs_update_approver" ON public.briefs;
CREATE POLICY "briefs_update_approver" ON public.briefs
  FOR UPDATE USING ( public.is_admin_or_approver() );

-- Posts: same pattern as briefs
DROP POLICY IF EXISTS "posts_select_own" ON public.posts;
CREATE POLICY "posts_select_own" ON public.posts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_select_approver" ON public.posts;
CREATE POLICY "posts_select_approver" ON public.posts
  FOR SELECT USING ( public.is_admin_or_approver() );

DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_update_approver" ON public.posts;
CREATE POLICY "posts_update_approver" ON public.posts
  FOR UPDATE USING ( public.is_admin_or_approver() );

-- Buffer connections: only owner
DROP POLICY IF EXISTS "buffer_select_own" ON public.buffer_connections;
CREATE POLICY "buffer_select_own" ON public.buffer_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "buffer_insert_own" ON public.buffer_connections;
CREATE POLICY "buffer_insert_own" ON public.buffer_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "buffer_update_own" ON public.buffer_connections;
CREATE POLICY "buffer_update_own" ON public.buffer_connections
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_briefs_user_id ON public.briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_briefs_status ON public.briefs(status);
CREATE INDEX IF NOT EXISTS idx_posts_brief_id ON public.posts(brief_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON public.posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON public.posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_buffer_post_id ON public.posts(buffer_post_id);
