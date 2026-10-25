// ============================================================
// Core types for the Family Tree Platform
// ============================================================

export type PermissionLevel = 'viewer' | 'contributor' | 'admin';
export type TreeStatus = 'active' | 'archived';
export type GenderType = 'male' | 'female';
export type SubmissionType = 'add_member' | 'edit_member' | 'add_relation' | 'remove_member';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface GranularPermissions {
  can_view_tree: boolean;
  can_view_details: boolean;
  can_add_members: boolean;
  can_edit_members: boolean;
  can_manage_relations: boolean;
  can_delete_members: boolean;
  can_manage_tree: boolean;
  is_suspended?: boolean;
}

export type TreeVisibility = 'public' | 'private';
export type TreePublishStatus = 'draft' | 'pending_approval' | 'published' | 'rejected';

export interface FamilyTree {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  cover_image_url?: string;
  status: TreeStatus;
  visibility?: TreeVisibility;
  publish_status?: TreePublishStatus;
  publish_request_note?: string;
  publish_rejection_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Computed fields (from joins or user context)
  member_count?: number;
  user_permission?: PermissionLevel;
  user_granular_permissions?: GranularPermissions;
  has_access?: boolean;
  is_owner?: boolean;
  pending_request?: TreeAccessRequest | null;
}

export interface Person {
  id: string;
  full_name_ar: string;
  full_name_en: string;
  birth_year?: number;
  death_year?: number;
  is_alive: boolean;
  gender: GenderType;
  bio_ar?: string;
  bio_en?: string;
  photo_url?: string;
  phone?: string;
  email?: string;
  location?: string;
  father_id?: string;
  mother_id?: string;
  spouse_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Computed / joined
  father?: Person;
  mother?: Person;
  spouse?: Person;
  children?: Person[];
  trees?: string[]; // tree IDs this person belongs to
}

export interface FamilyTreeMember {
  id: string;
  tree_id: string;
  person_id: string;
  is_root: boolean;
  joined_at: string;
}

export interface FamilyTreePermission extends GranularPermissions {
  id: string;
  tree_id: string;
  user_id: string;
  permission_level: PermissionLevel;
  granted_by?: string;
  granted_at: string;
  updated_at?: string;
  // Joined
  profile?: Profile;
  tree?: FamilyTree;
}

export interface TreeAccessRequest {
  id: string;
  tree_id: string;
  user_id: string;
  status: AccessRequestStatus;
  request_note?: string;
  admin_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  profile?: Profile;
  tree?: FamilyTree;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id?: string;
  tree_id?: string;
  details: Record<string, unknown>;
  created_at: string;
  admin_profile?: Profile;
}

export interface PendingSubmission {
  id: string;
  tree_id: string;
  submitted_by: string;
  submission_type: SubmissionType;
  payload: Record<string, unknown>;
  status: SubmissionStatus;
  admin_note?: string;
  reviewed_by?: string;
  created_at: string;
  reviewed_at?: string;
  // Joined
  submitter_profile?: Profile;
  tree?: FamilyTree;
}

export interface SubmissionHistory {
  id: string;
  tree_id: string;
  submission_id?: string;
  action: string;
  performed_by?: string;
  details: Record<string, unknown>;
  created_at: string;
}

// Generation row structure for the visual tree
export interface GenerationRow {
  generation: number;
  members: Person[];
}

// Auth context type
export interface AuthUser {
  id: string;
  email: string;
  is_admin: boolean;
  profile?: Profile;
}
