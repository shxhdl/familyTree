-- ============================================================
-- MIGRATION 004: User Private Trees & Publishing Workflow
-- ============================================================

-- 1. ADD VISIBILITY & PUBLISH WORKFLOW COLUMNS TO family_trees
ALTER TABLE public.family_trees
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'published' CHECK (publish_status IN ('draft', 'pending_approval', 'published', 'rejected')),
  ADD COLUMN IF NOT EXISTS publish_request_note TEXT,
  ADD COLUMN IF NOT EXISTS publish_rejection_reason TEXT;

-- Existing trees remain public and published
UPDATE public.family_trees
SET visibility = 'public', publish_status = 'published'
WHERE visibility IS NULL OR publish_status IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_trees_created_by ON public.family_trees(created_by);
CREATE INDEX IF NOT EXISTS idx_family_trees_visibility ON public.family_trees(visibility);
CREATE INDEX IF NOT EXISTS idx_family_trees_publish_status ON public.family_trees(publish_status);

-- 2. TRIGGER: AUTOMATICALLY GRANT FULL OWNER PERMISSIONS TO CREATOR
CREATE OR REPLACE FUNCTION public.handle_new_tree_creator_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.family_tree_permissions (
      tree_id,
      user_id,
      permission_level,
      can_view_tree,
      can_view_details,
      can_add_members,
      can_edit_members,
      can_manage_relations,
      can_delete_members,
      can_manage_tree,
      is_suspended
    ) VALUES (
      NEW.id,
      NEW.created_by,
      'admin',
      true, true, true, true, true, true, true, false
    )
    ON CONFLICT (tree_id, user_id) DO UPDATE SET
      permission_level = 'admin',
      can_view_tree = true,
      can_view_details = true,
      can_add_members = true,
      can_edit_members = true,
      can_manage_relations = true,
      can_delete_members = true,
      can_manage_tree = true,
      is_suspended = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tree_created_grant_owner ON public.family_trees;
CREATE TRIGGER on_tree_created_grant_owner
  AFTER INSERT ON public.family_trees
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_tree_creator_permissions();

-- 3. UPDATED RLS POLICIES FOR family_trees

-- SELECT:
-- - Public & published trees are visible to everyone
-- - Private/draft/pending trees are ONLY visible to creator, authorized users, or super admin
DROP POLICY IF EXISTS "trees_select" ON public.family_trees;
CREATE POLICY "trees_select" ON public.family_trees FOR SELECT TO authenticated
  USING (
    (visibility = 'public' AND publish_status = 'published' AND status = 'active')
    OR created_by = auth.uid()
    OR public.is_admin()
    OR public.can_view_tree(id)
  );

-- INSERT: Authenticated users can create their own tree
DROP POLICY IF EXISTS "trees_insert" ON public.family_trees;
CREATE POLICY "trees_insert" ON public.family_trees FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR created_by = auth.uid()
  );

-- UPDATE: Creator or admin can update the tree
DROP POLICY IF EXISTS "trees_update" ON public.family_trees;
CREATE POLICY "trees_update" ON public.family_trees FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR created_by = auth.uid()
  );

-- DELETE: Creator or admin can delete the tree
DROP POLICY IF EXISTS "trees_delete" ON public.family_trees;
CREATE POLICY "trees_delete" ON public.family_trees FOR DELETE TO authenticated
  USING (
    public.is_admin() OR created_by = auth.uid()
  );

-- 4. RLS POLICIES FOR persons AND family_tree_members
DROP POLICY IF EXISTS "persons_select" ON public.persons;
CREATE POLICY "persons_select" ON public.persons FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "persons_insert" ON public.persons;
CREATE POLICY "persons_insert" ON public.persons FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "persons_update" ON public.persons;
CREATE POLICY "persons_update" ON public.persons FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "persons_delete" ON public.persons;
CREATE POLICY "persons_delete" ON public.persons FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ftm_insert" ON public.family_tree_members;
CREATE POLICY "ftm_insert" ON public.family_tree_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.tree_id AND ft.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_tree_permissions ftp
      WHERE ftp.tree_id = family_tree_members.tree_id
        AND ftp.user_id = auth.uid()
        AND ftp.is_suspended = false
        AND (ftp.can_add_members = true OR ftp.permission_level IN ('contributor', 'admin'))
    )
  );

DROP POLICY IF EXISTS "ftm_delete" ON public.family_tree_members;
CREATE POLICY "ftm_delete" ON public.family_tree_members FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.tree_id AND ft.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_tree_permissions ftp
      WHERE ftp.tree_id = family_tree_members.tree_id
        AND ftp.user_id = auth.uid()
        AND ftp.is_suspended = false
        AND (ftp.can_delete_members = true OR ftp.permission_level = 'admin')
    )
  );

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
