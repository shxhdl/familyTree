-- ============================================================
-- FAMILY TREE PLATFORM — Complete Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
    CREATE TYPE public.permission_level AS ENUM ('viewer', 'contributor', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.tree_status AS ENUM ('active', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.gender_type AS ENUM ('male', 'female');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.submission_type AS ENUM ('add_member', 'edit_member', 'add_relation', 'remove_member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- TABLE: app_admins
-- Tracks super admins for the platform
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_super_admin BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: profiles
-- Public user profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: family_trees
-- Each row is one independent family tree
-- ============================================================
CREATE TABLE IF NOT EXISTS public.family_trees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL DEFAULT '',
    description_ar TEXT,
    description_en TEXT,
    cover_image_url TEXT,
    status public.tree_status NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: persons
-- Shared person records — can belong to multiple trees
-- father_id enforces paternal lineage rule
-- ============================================================
CREATE TABLE IF NOT EXISTS public.persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name_ar TEXT NOT NULL,
    full_name_en TEXT NOT NULL DEFAULT '',
    birth_year INTEGER,
    death_year INTEGER,
    is_alive BOOLEAN DEFAULT true,
    gender public.gender_type NOT NULL DEFAULT 'male',
    bio_ar TEXT,
    bio_en TEXT,
    photo_url TEXT,
    phone TEXT,
    email TEXT,
    location TEXT,
    father_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
    mother_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
    spouse_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: family_tree_members
-- Junction table: links persons to trees
-- A person can belong to multiple trees without duplication
-- ============================================================
CREATE TABLE IF NOT EXISTS public.family_tree_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    is_root BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tree_id, person_id)
);

-- ============================================================
-- TABLE: family_tree_permissions
-- Per-tree user access control
-- ============================================================
CREATE TABLE IF NOT EXISTS public.family_tree_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level public.permission_level NOT NULL DEFAULT 'viewer',
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tree_id, user_id)
);

-- ============================================================
-- TABLE: pending_submissions
-- All user-submitted changes await admin approval
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pending_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES auth.users(id),
    submission_type public.submission_type NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status public.submission_status NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: submission_history
-- Audit log of all approved/rejected changes per tree
-- ============================================================
CREATE TABLE IF NOT EXISTS public.submission_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES public.pending_submissions(id),
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_family_tree_members_tree_id ON public.family_tree_members(tree_id);
CREATE INDEX IF NOT EXISTS idx_family_tree_members_person_id ON public.family_tree_members(person_id);
CREATE INDEX IF NOT EXISTS idx_persons_father_id ON public.persons(father_id);
CREATE INDEX IF NOT EXISTS idx_pending_submissions_tree_id ON public.pending_submissions(tree_id);
CREATE INDEX IF NOT EXISTS idx_pending_submissions_status ON public.pending_submissions(status);
CREATE INDEX IF NOT EXISTS idx_family_tree_permissions_user_id ON public.family_tree_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_family_tree_permissions_tree_id ON public.family_tree_permissions(tree_id);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_tree_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_tree_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if user is a super admin
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = uid AND is_super_admin = true);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has at least a certain permission level for a tree
CREATE OR REPLACE FUNCTION public.user_tree_permission(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
  SELECT permission_level::TEXT FROM public.family_tree_permissions 
  WHERE tree_id = tree AND user_id = uid
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user can view a tree (admin OR has any permission)
CREATE OR REPLACE FUNCTION public.can_view_tree(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree AND user_id = uid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user can contribute to a tree (admin OR contributor/admin permission)
CREATE OR REPLACE FUNCTION public.can_contribute_tree(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree AND user_id = uid 
    AND permission_level IN ('contributor', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles: users manage their own, admins see all
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- family_trees: admins full access; others read if permitted
DROP POLICY IF EXISTS "trees_select" ON public.family_trees;
CREATE POLICY "trees_select" ON public.family_trees FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_view_tree(id));

DROP POLICY IF EXISTS "trees_insert" ON public.family_trees;
CREATE POLICY "trees_insert" ON public.family_trees FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "trees_update" ON public.family_trees;
CREATE POLICY "trees_update" ON public.family_trees FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "trees_delete" ON public.family_trees;
CREATE POLICY "trees_delete" ON public.family_trees FOR DELETE TO authenticated
  USING (public.is_admin());

-- persons: admins full access; permitted users read
DROP POLICY IF EXISTS "persons_select" ON public.persons;
CREATE POLICY "persons_select" ON public.persons FOR SELECT TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.family_tree_members ftm
      WHERE ftm.person_id = persons.id 
      AND public.can_view_tree(ftm.tree_id)
    )
  );

DROP POLICY IF EXISTS "persons_insert" ON public.persons;
CREATE POLICY "persons_insert" ON public.persons FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "persons_update" ON public.persons;
CREATE POLICY "persons_update" ON public.persons FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "persons_delete" ON public.persons;
CREATE POLICY "persons_delete" ON public.persons FOR DELETE TO authenticated
  USING (public.is_admin());

-- family_tree_members: admins full access; permitted users read
DROP POLICY IF EXISTS "ftm_select" ON public.family_tree_members;
CREATE POLICY "ftm_select" ON public.family_tree_members FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_view_tree(tree_id));

DROP POLICY IF EXISTS "ftm_insert" ON public.family_tree_members;
CREATE POLICY "ftm_insert" ON public.family_tree_members FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ftm_delete" ON public.family_tree_members;
CREATE POLICY "ftm_delete" ON public.family_tree_members FOR DELETE TO authenticated
  USING (public.is_admin());

-- family_tree_permissions: admins full access; users read their own
DROP POLICY IF EXISTS "ftp_select" ON public.family_tree_permissions;
CREATE POLICY "ftp_select" ON public.family_tree_permissions FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "ftp_all" ON public.family_tree_permissions;
CREATE POLICY "ftp_all" ON public.family_tree_permissions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- pending_submissions: admins see all; contributors see own + their tree
DROP POLICY IF EXISTS "ps_select" ON public.pending_submissions;
CREATE POLICY "ps_select" ON public.pending_submissions FOR SELECT TO authenticated
  USING (public.is_admin() OR submitted_by = auth.uid());

DROP POLICY IF EXISTS "ps_insert" ON public.pending_submissions;
CREATE POLICY "ps_insert" ON public.pending_submissions FOR INSERT TO authenticated
  WITH CHECK (public.can_contribute_tree(tree_id) AND submitted_by = auth.uid());

DROP POLICY IF EXISTS "ps_update" ON public.pending_submissions;
CREATE POLICY "ps_update" ON public.pending_submissions FOR UPDATE TO authenticated
  USING (public.is_admin());

-- submission_history: admins full; permitted users read their tree's history
DROP POLICY IF EXISTS "sh_select" ON public.submission_history;
CREATE POLICY "sh_select" ON public.submission_history FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_view_tree(tree_id));

DROP POLICY IF EXISTS "sh_insert" ON public.submission_history;
CREATE POLICY "sh_insert" ON public.submission_history FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- app_admins: only admins read
DROP POLICY IF EXISTS "aa_select" ON public.app_admins;
CREATE POLICY "aa_select" ON public.app_admins FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Automatically make the first user an admin if no admins exist
  IF NOT EXISTS (SELECT 1 FROM public.app_admins) THEN
    INSERT INTO public.app_admins (user_id, is_super_admin)
    VALUES (NEW.id, true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Automatically grant admin to any currently registered users
INSERT INTO public.app_admins (user_id, is_super_admin)
SELECT id, true FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET is_super_admin = true;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

