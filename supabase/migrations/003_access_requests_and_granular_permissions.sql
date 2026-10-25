-- ============================================================
-- MIGRATION 003: Access Requests & Granular Permissions System
-- ============================================================

-- 1. EXTEND family_tree_permissions WITH GRANULAR PERMISSION COLUMNS
ALTER TABLE public.family_tree_permissions
  ADD COLUMN IF NOT EXISTS can_view_tree BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_details BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_add_members BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_members BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_relations BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_members BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_tree BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. CREATE TABLE: tree_access_requests
CREATE TABLE IF NOT EXISTS public.tree_access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    request_note TEXT,
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index: only ONE pending request per user per tree
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request 
ON public.tree_access_requests(tree_id, user_id) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_tree_access_requests_tree_id ON public.tree_access_requests(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_access_requests_user_id ON public.tree_access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_tree_access_requests_status ON public.tree_access_requests(status);

-- 3. CREATE TABLE: admin_audit_logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tree_id UUID REFERENCES public.family_trees(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_tree_id ON public.admin_audit_logs(tree_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user ON public.admin_audit_logs(target_user_id);

-- 4. ENABLE ROW LEVEL SECURITY ON NEW TABLES
ALTER TABLE public.tree_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. GRANULAR PERMISSION HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.can_view_tree(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree 
      AND user_id = uid 
      AND can_view_tree = true 
      AND is_suspended = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_view_details(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree 
      AND user_id = uid 
      AND can_view_details = true 
      AND is_suspended = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_add_members(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree 
      AND user_id = uid 
      AND can_add_members = true 
      AND is_suspended = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_edit_members(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree 
      AND user_id = uid 
      AND can_edit_members = true 
      AND is_suspended = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_manage_relations(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree 
      AND user_id = uid 
      AND can_manage_relations = true 
      AND is_suspended = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_delete_members(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree 
      AND user_id = uid 
      AND can_delete_members = true 
      AND is_suspended = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_manage_tree(tree UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT public.is_admin(uid) OR EXISTS (
    SELECT 1 FROM public.family_tree_permissions 
    WHERE tree_id = tree 
      AND user_id = uid 
      AND can_manage_tree = true 
      AND is_suspended = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. SYSTEM STATS FUNCTION (FOR REAL TIME ACCURATE COUNTS)
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSONB AS $$
DECLARE
  v_users_count BIGINT;
  v_trees_count BIGINT;
  v_persons_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_users_count FROM public.profiles;
  SELECT COUNT(*) INTO v_trees_count FROM public.family_trees WHERE status = 'active';
  SELECT COUNT(*) INTO v_persons_count FROM public.persons;
  RETURN jsonb_build_object(
    'users_count', v_users_count,
    'trees_count', v_trees_count,
    'persons_count', v_persons_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;

-- 7. REVISE RLS POLICIES

-- family_trees: Public can view active tree cards (names, descriptions, covers)
DROP POLICY IF EXISTS "trees_select" ON public.family_trees;
CREATE POLICY "trees_select" ON public.family_trees FOR SELECT TO public
  USING (status = 'active' OR public.is_admin());

-- tree_access_requests:
-- Authenticated users can view their own requests; Admins can view all
DROP POLICY IF EXISTS "access_requests_select" ON public.tree_access_requests;
CREATE POLICY "access_requests_select" ON public.tree_access_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Users can submit requests for themselves
DROP POLICY IF EXISTS "access_requests_insert" ON public.tree_access_requests;
CREATE POLICY "access_requests_insert" ON public.tree_access_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can update requests (approve/reject)
DROP POLICY IF EXISTS "access_requests_update" ON public.tree_access_requests;
CREATE POLICY "access_requests_update" ON public.tree_access_requests FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Users can delete/cancel their own pending request, or admins can delete
DROP POLICY IF EXISTS "access_requests_delete" ON public.tree_access_requests;
CREATE POLICY "access_requests_delete" ON public.tree_access_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- admin_audit_logs: Admins only
DROP POLICY IF EXISTS "audit_logs_select" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_select" ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_insert" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_insert" ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- profiles: Allow authenticated users to view profiles (needed for user names in access requests & trees)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
