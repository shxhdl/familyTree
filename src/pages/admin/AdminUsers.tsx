import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import PermissionsModal from '@/components/PermissionsModal';
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  Shield,
  Eye,
  UserPlus,
  Network,
  Settings,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  TreePine,
  Check,
  User as UserIcon,
  RefreshCw,
} from 'lucide-react';
import type { FamilyTree, FamilyTreePermission, Profile, GranularPermissions } from '@/types';

interface UserWithPermissions extends Profile {
  treePermissions: (FamilyTreePermission & { tree_name?: string })[];
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [permissions, setPermissions] = useState<FamilyTreePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTreeFilter, setSelectedTreeFilter] = useState('all');
  const [error, setError] = useState('');

  // Modals state
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<{ id: string; name: string; email: string } | null>(null);
  const [selectedTreeForPerms, setSelectedTreeForPerms] = useState<{ id: string; name: string } | null>(null);
  const [editingInitialPerms, setEditingInitialPerms] = useState<Partial<GranularPermissions> | undefined>(undefined);

  // Grant New Tree Access form state
  const [grantFormUserId, setGrantFormUserId] = useState('');
  const [grantFormTreeId, setGrantFormTreeId] = useState('');

  // Delete tree access confirmation
  const [revokingPerm, setRevokingPerm] = useState<{ id: string; userName: string; treeName: string; userId: string; treeId: string } | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Load all registered profiles
      const { data: profsData, error: profsErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profsErr) throw profsErr;
      setProfiles((profsData || []) as Profile[]);

      // 2. Load all family trees
      const { data: treesData, error: treesErr } = await supabase
        .from('family_trees')
        .select('id, name_ar, name_en')
        .order('name_ar');

      if (treesErr) throw treesErr;
      setTrees((treesData || []) as FamilyTree[]);

      // 3. Load all permissions
      const { data: permsData, error: permsErr } = await supabase
        .from('family_tree_permissions')
        .select('*');

      if (permsErr) throw permsErr;

      const normalizedPerms: FamilyTreePermission[] = (permsData || []).map((p: any) => {
        const level = p.permission_level || 'viewer';
        const isAdminLevel = level === 'admin' || level === 'tree_admin';
        const isContributorLevel = level === 'contributor' || level === 'editor';

        return {
          ...p,
          permission_level: level,
          can_view_tree: p.can_view_tree ?? true,
          can_view_details: p.can_view_details ?? (isAdminLevel || isContributorLevel),
          can_add_members: p.can_add_members ?? (isAdminLevel || isContributorLevel),
          can_edit_members: p.can_edit_members ?? (isAdminLevel || isContributorLevel),
          can_manage_relations: p.can_manage_relations ?? (isAdminLevel || isContributorLevel),
          can_delete_members: p.can_delete_members ?? isAdminLevel,
          can_manage_tree: p.can_manage_tree ?? isAdminLevel,
          is_suspended: p.is_suspended ?? false,
        };
      });

      setPermissions(normalizedPerms);
    } catch (err: any) {
      console.error(err);
      setError('خطأ أثناء تحميل البيانات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by user
  const usersWithPermissions: UserWithPermissions[] = useMemo(() => {
    const treesMap = new Map<string, string>();
    trees.forEach(t => treesMap.set(t.id, t.name_ar));

    return profiles.map(profile => {
      const userPerms = permissions
        .filter(p => p.user_id === profile.user_id)
        .map(p => ({
          ...p,
          tree_name: treesMap.get(p.tree_id) || 'شجرة غير معروفة',
        }));

      return {
        ...profile,
        treePermissions: userPerms,
      };
    });
  }, [profiles, trees, permissions]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return usersWithPermissions.filter(u => {
      const name = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || name.includes(searchLower) || email.includes(searchLower);

      const matchesTree =
        selectedTreeFilter === 'all' ||
        u.treePermissions.some(p => p.tree_id === selectedTreeFilter);

      return matchesSearch && matchesTree;
    });
  }, [usersWithPermissions, search, selectedTreeFilter]);

  // Quick Toggle Suspend User
  const handleToggleSuspend = async (perm: FamilyTreePermission & { tree_name?: string }, userName: string) => {
    const newSuspended = !perm.is_suspended;
    try {
      const { error: updErr } = await supabase
        .from('family_tree_permissions')
        .update({
          is_suspended: newSuspended,
          updated_at: new Date().toISOString(),
        })
        .eq('id', perm.id);

      if (updErr) throw updErr;

      // Log to audit
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_id: user?.id,
          action: newSuspended ? 'suspend_user_access' : 'reactivate_user_access',
          target_user_id: perm.user_id,
          tree_id: perm.tree_id,
          details: {
            user_name: userName,
            tree_name: perm.tree_name,
            is_suspended: newSuspended,
          },
        });
      } catch (logErr) {
        console.warn('Audit error:', logErr);
      }

      loadAllData();
    } catch (err: any) {
      alert('خطأ أثناء تعديل حالة التعليق: ' + err.message);
    }
  };

  // Revoke Tree Access
  const handleRevokeConfirm = async () => {
    if (!revokingPerm) return;
    try {
      const { error: delErr } = await supabase
        .from('family_tree_permissions')
        .delete()
        .eq('id', revokingPerm.id);

      if (delErr) throw delErr;

      // Log audit
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_id: user?.id,
          action: 'revoke_tree_access',
          target_user_id: revokingPerm.userId,
          tree_id: revokingPerm.treeId,
          details: {
            user_name: revokingPerm.userName,
            tree_name: revokingPerm.treeName,
          },
        });
      } catch (logErr) {
        console.warn('Audit error:', logErr);
      }

      setRevokingPerm(null);
      loadAllData();
    } catch (err: any) {
      alert('خطأ أثناء إلغاء الوصول: ' + err.message);
    }
  };

  // Open Edit Granular Permissions Modal
  const handleEditPerms = (perm: FamilyTreePermission & { tree_name?: string }, u: UserWithPermissions) => {
    setSelectedUserForPerms({
      id: u.user_id,
      name: u.full_name || 'مستخدم',
      email: u.email,
    });
    setSelectedTreeForPerms({
      id: perm.tree_id,
      name: perm.tree_name || 'الشجرة',
    });
    setEditingInitialPerms({
      can_view_tree: perm.can_view_tree,
      can_view_details: perm.can_view_details,
      can_add_members: perm.can_add_members,
      can_edit_members: perm.can_edit_members,
      can_manage_relations: perm.can_manage_relations,
      can_delete_members: perm.can_delete_members,
      can_manage_tree: perm.can_manage_tree,
      is_suspended: perm.is_suspended,
    });
  };

  // Open Grant New Tree Modal
  const handleOpenGrantModal = (preselectedUserId?: string) => {
    setGrantFormUserId(preselectedUserId || (profiles[0]?.user_id ?? ''));
    setGrantFormTreeId(trees[0]?.id ?? '');
    setShowGrantModal(true);
  };

  const handleGrantProceed = (e: React.FormEvent) => {
    e.preventDefault();
    const prof = profiles.find(p => p.user_id === grantFormUserId);
    const tr = trees.find(t => t.id === grantFormTreeId);
    if (!prof || !tr) return;

    // Check existing permissions if any
    const existing = permissions.find(p => p.user_id === prof.user_id && p.tree_id === tr.id);

    setShowGrantModal(false);
    setSelectedUserForPerms({
      id: prof.user_id,
      name: prof.full_name || 'مستخدم',
      email: prof.email,
    });
    setSelectedTreeForPerms({
      id: tr.id,
      name: tr.name_ar,
    });
    setEditingInitialPerms(existing ? {
      can_view_tree: existing.can_view_tree,
      can_view_details: existing.can_view_details,
      can_add_members: existing.can_add_members,
      can_edit_members: existing.can_edit_members,
      can_manage_relations: existing.can_manage_relations,
      can_delete_members: existing.can_delete_members,
      can_manage_tree: existing.can_manage_tree,
      is_suspended: existing.is_suspended,
    } : {
      can_view_tree: true,
      can_view_details: false,
      can_add_members: false,
      can_edit_members: false,
      can_manage_relations: false,
      can_delete_members: false,
      can_manage_tree: false,
      is_suspended: false,
    });
  };

  return (
    <AdminLayout title="إدارة الصلاحيات والمستخدمين" subtitle="Permissions & Access Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Top Actions & Description */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <h2 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              صلاحيات المستخدمين على أشجار العائلة
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
              تحكم مستقل في كل شجرة: منح الوصول، تعديل الصلاحيات السبع، تعليق الوصول مؤقتاً، أو إلغاء الوصول كلياً.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadAllData}
              title="تحديث البيانات"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={14} />
              <span>تحديث</span>
            </button>

            <button
              className="btn btn-primary"
              onClick={() => handleOpenGrantModal()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Tajawal, sans-serif' }}
              id="grant-tree-btn"
            >
              <Plus size={16} />
              منح وصول لشجرة جديدة
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Filters */}
        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface)',
          padding: 16,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
        }}>
          {/* Search by user name or email */}
          <div className="search-bar" style={{ minWidth: 260, flex: '1 1 260px' }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="ابحث بالاسم أو البريد الإلكتروني..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="search-users-permissions"
            />
          </div>

          {/* Tree filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              الشجرة:
            </label>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: 180 }}
              value={selectedTreeFilter}
              onChange={e => setSelectedTreeFilter(e.target.value)}
            >
              <option value="all">كل الأشجار</option>
              {trees.map(t => (
                <option key={t.id} value={t.id}>{t.name_ar}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Users List with their Trees and Granular Permissions */}
        {loading ? (
          <div className="loading-center" style={{ minHeight: 250 }}>
            <div className="spinner" />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>جاري تحميل المستخدمين والصلاحيات...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>لا يوجد مستخدمون مطابقون للبحث</h3>
            <p style={{ fontFamily: 'Tajawal, sans-serif' }}>جرب البحث بكلمات أخرى أو اختر شجرة أخرى</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredUsers.map(u => {
              const displayName = u.full_name?.trim() || 'مستخدم بدون اسم';

              return (
                <div
                  key={u.id || u.user_id}
                  className="card"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 20,
                  }}
                >
                  {/* User Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 12,
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--color-primary), #0284c7)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '1.1rem', flexShrink: 0,
                      }}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '1.05rem' }}>
                          {displayName}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', direction: 'ltr', textAlign: 'right' }}>
                          {u.email}
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenGrantModal(u.user_id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Tajawal, sans-serif' }}
                    >
                      <Plus size={14} />
                      منح شجرة إضافية
                    </button>
                  </div>

                  {/* Accessible Trees & Permissions */}
                  {u.treePermissions.length === 0 ? (
                    <div style={{
                      background: 'var(--color-surface-2)',
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'Tajawal, sans-serif',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>هذا المستخدم لا يملك صلاحية وصول إلى أي شجرة عائلية حتى الآن.</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleOpenGrantModal(u.user_id)}
                        style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                      >
                        + منح وصول
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {u.treePermissions.map(perm => (
                        <div
                          key={perm.id}
                          style={{
                            background: perm.is_suspended ? '#fff7ed' : 'var(--color-surface-2)',
                            border: perm.is_suspended ? '1px solid #fdba74' : '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          {/* Tree Title & Action Buttons */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TreePine size={18} color="var(--color-primary)" />
                              <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '0.95rem' }}>
                                {perm.tree_name}
                              </span>

                              {/* Suspended status badge */}
                              {perm.is_suspended ? (
                                <span className="badge badge-yellow" style={{ fontSize: '0.72rem', background: '#fed7aa', color: '#9a3412', border: '1px solid #ea580c' }}>
                                  وصول معلق مؤقتاً
                                </span>
                              ) : (
                                <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>
                                  وصول نشط
                                </span>
                              )}
                            </div>

                            {/* Actions for this tree */}
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {/* Edit Permissions button */}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleEditPerms(perm, u)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Tajawal, sans-serif', fontSize: '0.78rem' }}
                                title="تعديل الصلاحيات الممنوحة"
                              >
                                <Edit3 size={13} />
                                تعديل الصلاحيات
                              </button>

                              {/* Toggle Suspend button */}
                              <button
                                className={`btn btn-sm ${perm.is_suspended ? 'btn-secondary' : 'btn-ghost'}`}
                                onClick={() => handleToggleSuspend(perm, displayName)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontFamily: 'Tajawal, sans-serif',
                                  fontSize: '0.78rem',
                                  color: perm.is_suspended ? '#065f46' : '#d97706',
                                }}
                                title={perm.is_suspended ? 'إعادة تفعيل الوصول' : 'تعليق الوصول مؤقتاً'}
                              >
                                {perm.is_suspended ? (
                                  <>
                                    <PlayCircle size={14} />
                                    تفعيل
                                  </>
                                ) : (
                                  <>
                                    <PauseCircle size={14} />
                                    تعليق
                                  </>
                                )}
                              </button>

                              {/* Revoke entire tree access */}
                              <button
                                className="btn btn-ghost btn-sm btn-icon"
                                onClick={() => setRevokingPerm({
                                  id: perm.id,
                                  userName: displayName,
                                  treeName: perm.tree_name || '',
                                  userId: perm.user_id,
                                  treeId: perm.tree_id,
                                })}
                                style={{ color: 'var(--color-danger)' }}
                                title="إلغاء الوصول للشجرة كلياً"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Granular Permissions Badges */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <span
                              className={`badge ${perm.can_view_tree ? 'badge-blue' : 'badge-gray'}`}
                              style={{ opacity: perm.can_view_tree ? 1 : 0.5, fontSize: '0.75rem' }}
                            >
                              <Eye size={11} /> عرض الشجرة
                            </span>
                            <span
                              className={`badge ${perm.can_view_details ? 'badge-blue' : 'badge-gray'}`}
                              style={{ opacity: perm.can_view_details ? 1 : 0.5, fontSize: '0.75rem' }}
                            >
                              <Shield size={11} /> عرض التفاصيل
                            </span>
                            <span
                              className={`badge ${perm.can_add_members ? 'badge-green' : 'badge-gray'}`}
                              style={{ opacity: perm.can_add_members ? 1 : 0.5, fontSize: '0.75rem' }}
                            >
                              <UserPlus size={11} /> إضافة أشخاص
                            </span>
                            <span
                              className={`badge ${perm.can_edit_members ? 'badge-purple' : 'badge-gray'}`}
                              style={{ opacity: perm.can_edit_members ? 1 : 0.5, fontSize: '0.75rem' }}
                            >
                              <Edit3 size={11} /> تعديل البيانات
                            </span>
                            <span
                              className={`badge ${perm.can_manage_relations ? 'badge-purple' : 'badge-gray'}`}
                              style={{ opacity: perm.can_manage_relations ? 1 : 0.5, fontSize: '0.75rem' }}
                            >
                              <Network size={11} /> إدارة العلاقات
                            </span>
                            <span
                              className={`badge ${perm.can_delete_members ? 'badge-red' : 'badge-gray'}`}
                              style={{ opacity: perm.can_delete_members ? 1 : 0.5, fontSize: '0.75rem' }}
                            >
                              <Trash2 size={11} /> حذف الأشخاص
                            </span>
                            <span
                              className={`badge ${perm.can_manage_tree ? 'badge-red' : 'badge-gray'}`}
                              style={{ opacity: perm.can_manage_tree ? 1 : 0.5, fontSize: '0.75rem' }}
                            >
                              <Settings size={11} /> إدارة الشجرة
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grant New Tree Access Picker Modal */}
      {showGrantModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowGrantModal(false)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif' }}>منح وصول لشجرة عائلية</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowGrantModal(false)}>✕</button>
            </div>
            <form onSubmit={handleGrantProceed}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'Tajawal, sans-serif' }}>المستخدم</label>
                  <select
                    className="form-select"
                    value={grantFormUserId}
                    onChange={e => setGrantFormUserId(e.target.value)}
                    required
                  >
                    {profiles.map(p => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.full_name || 'مستخدم بدون اسم'} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'Tajawal, sans-serif' }}>شجرة العائلة</label>
                  <select
                    className="form-select"
                    value={grantFormTreeId}
                    onChange={e => setGrantFormTreeId(e.target.value)}
                    required
                  >
                    {trees.map(t => (
                      <option key={t.id} value={t.id}>{t.name_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowGrantModal(false)} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  التالي: تحديد الصلاحيات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Granular Permissions Modal */}
      {selectedUserForPerms && selectedTreeForPerms && (
        <PermissionsModal
          isOpen={true}
          onClose={() => {
            setSelectedUserForPerms(null);
            setSelectedTreeForPerms(null);
            setEditingInitialPerms(undefined);
          }}
          onSuccess={() => {
            setSelectedUserForPerms(null);
            setSelectedTreeForPerms(null);
            setEditingInitialPerms(undefined);
            loadAllData();
          }}
          targetUser={selectedUserForPerms}
          targetTree={selectedTreeForPerms}
          initialPermissions={editingInitialPerms}
        />
      )}

      {/* Revoke Confirmation Modal */}
      {revokingPerm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRevokingPerm(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)' }}>
                إلغاء الوصول للشجرة
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setRevokingPerm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontFamily: 'Tajawal, sans-serif', lineHeight: 1.6 }}>
                هل أنت متأكد من إلغاء وصول المستخدم <strong>{revokingPerm.userName}</strong> إلى الشجرة{' '}
                <strong>{revokingPerm.treeName}</strong> بشكل كامل؟
              </p>
              <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.82rem', marginTop: 12 }}>
                سيتم سحب جميع الصلاحيات ولن يتمكن المستخدم من فتح الشجرة حتى يتم منحها له مجدداً.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setRevokingPerm(null)} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                تراجع
              </button>
              <button type="button" className="btn btn-danger" onClick={handleRevokeConfirm} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                تأكيد الإلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
