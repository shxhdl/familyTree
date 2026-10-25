-- ============================================================
-- MIGRATION 005: Tree Creator Access Request & Permissions Management
-- Allows members who created trees to view, approve, reject,
-- and manage permissions on their own trees directly
-- without requiring system admin intervention.
-- ============================================================

-- 1. HELPER FUNCTION: Check if a user is the creator/owner of a tree
-- SECURITY DEFINER allows this check to bypass RLS recursion safely
CREATE OR REPLACE FUNCTION public.is_tree_creator(tree_uuid UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_trees 
    WHERE id = tree_uuid AND created_by = uid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_tree_creator(UUID, UUID) TO authenticated, anon;

-- 2. TREE ACCESS REQUESTS RLS POLICIES
-- Tree creator can view requests submitted for their own trees
DROP POLICY IF EXISTS "access_requests_select" ON public.tree_access_requests;
CREATE POLICY "access_requests_select" ON public.tree_access_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_admin()
    OR public.is_tree_creator(tree_id, auth.uid())
  );

-- Tree creator can update (approve / reject) requests for their own trees
DROP POLICY IF EXISTS "access_requests_update" ON public.tree_access_requests;
CREATE POLICY "access_requests_update" ON public.tree_access_requests FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_tree_creator(tree_id, auth.uid())
  );

-- Tree creator can delete requests for their own trees
DROP POLICY IF EXISTS "access_requests_delete" ON public.tree_access_requests;
CREATE POLICY "access_requests_delete" ON public.tree_access_requests FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_admin()
    OR public.is_tree_creator(tree_id, auth.uid())
  );

-- 3. FAMILY TREE PERMISSIONS RLS POLICIES
-- Tree creator can view permissions on their own trees
DROP POLICY IF EXISTS "ftp_select" ON public.family_tree_permissions;
CREATE POLICY "ftp_select" ON public.family_tree_permissions FOR SELECT TO authenticated
  USING (
    public.is_admin() 
    OR user_id = auth.uid()
    OR public.is_tree_creator(tree_id, auth.uid())
  );

-- Tree creator can insert permissions on their own trees (when approving requests)
DROP POLICY IF EXISTS "ftp_insert" ON public.family_tree_permissions;
CREATE POLICY "ftp_insert" ON public.family_tree_permissions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_tree_creator(tree_id, auth.uid())
  );

-- Tree creator can update permissions on their own trees
DROP POLICY IF EXISTS "ftp_update" ON public.family_tree_permissions;
CREATE POLICY "ftp_update" ON public.family_tree_permissions FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_tree_creator(tree_id, auth.uid())
  );

-- Tree creator can delete (revoke) permissions on their own trees
DROP POLICY IF EXISTS "ftp_delete" ON public.family_tree_permissions;
CREATE POLICY "ftp_delete" ON public.family_tree_permissions FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.is_tree_creator(tree_id, auth.uid())
  );

-- 4. PROFILES RLS POLICY
-- Allows authenticated members to see names and emails of requesters
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
