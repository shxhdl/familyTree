import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, Shield, Eye, UserPlus, Edit3, Network, Trash2, Settings, AlertCircle, Check, PauseCircle, PlayCircle } from 'lucide-react';
import type { GranularPermissions, Profile, FamilyTree } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetUser: { id: string; name: string; email: string };
  targetTree: { id: string; name: string };
  initialPermissions?: Partial<GranularPermissions>;
  requestIdToApprove?: string; // If opened from access request approval
}

export default function PermissionsModal({
  isOpen,
  onClose,
  onSuccess,
  targetUser,
  targetTree,
  initialPermissions,
  requestIdToApprove,
}: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Default permissions: only can_view_tree is enabled by default, rest disabled!
  const [perms, setPerms] = useState<GranularPermissions>({
    can_view_tree: true,
    can_view_details: false,
    can_add_members: false,
    can_edit_members: false,
    can_manage_relations: false,
    can_delete_members: false,
    can_manage_tree: false,
    is_suspended: false,
  });

  useEffect(() => {
    if (initialPermissions) {
      setPerms({
        can_view_tree: initialPermissions.can_view_tree ?? true,
        can_view_details: initialPermissions.can_view_details ?? false,
        can_add_members: initialPermissions.can_add_members ?? false,
        can_edit_members: initialPermissions.can_edit_members ?? false,
        can_manage_relations: initialPermissions.can_manage_relations ?? false,
        can_delete_members: initialPermissions.can_delete_members ?? false,
        can_manage_tree: initialPermissions.can_manage_tree ?? false,
        is_suspended: initialPermissions.is_suspended ?? false,
      });
    } else {
      setPerms({
        can_view_tree: true,
        can_view_details: false,
        can_add_members: false,
        can_edit_members: false,
        can_manage_relations: false,
        can_delete_members: false,
        can_manage_tree: false,
        is_suspended: false,
      });
    }
    setError('');
  }, [initialPermissions, isOpen]);

  if (!isOpen) return null;

  const applyPreset = (preset: 'viewer' | 'editor' | 'admin') => {
    if (preset === 'viewer') {
      setPerms({
        can_view_tree: true,
        can_view_details: true,
        can_add_members: false,
        can_edit_members: false,
        can_manage_relations: false,
        can_delete_members: false,
        can_manage_tree: false,
        is_suspended: false,
      });
    } else if (preset === 'editor') {
      setPerms({
        can_view_tree: true,
        can_view_details: true,
        can_add_members: true,
        can_edit_members: true,
        can_manage_relations: true,
        can_delete_members: false,
        can_manage_tree: false,
        is_suspended: false,
      });
    } else if (preset === 'admin') {
      setPerms({
        can_view_tree: true,
        can_view_details: true,
        can_add_members: true,
        can_edit_members: true,
        can_manage_relations: true,
        can_delete_members: true,
        can_manage_tree: true,
        is_suspended: false,
      });
    }
  };

  const currentRole = perms.can_manage_tree || perms.can_delete_members
    ? 'admin'
    : perms.can_add_members || perms.can_edit_members || perms.can_manage_relations
    ? 'editor'
    : 'viewer';

  const togglePerm = (key: keyof GranularPermissions) => {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Determine permission level tag for legacy compatibility
      let legacyLevel: 'viewer' | 'contributor' | 'admin' = 'viewer';
      if (perms.can_manage_tree || perms.can_delete_members) {
        legacyLevel = 'admin';
      } else if (perms.can_add_members || perms.can_edit_members || perms.can_manage_relations) {
        legacyLevel = 'contributor';
      }

      // Upsert into family_tree_permissions
      let permErr: any = null;

      // 1. First attempt: upsert with granular columns
      const fullPayload = {
        tree_id: targetTree.id,
        user_id: targetUser.id,
        permission_level: legacyLevel,
        can_view_tree: perms.can_view_tree,
        can_view_details: perms.can_view_details,
        can_add_members: perms.can_add_members,
        can_edit_members: perms.can_edit_members,
        can_manage_relations: perms.can_manage_relations,
        can_delete_members: perms.can_delete_members,
        can_manage_tree: perms.can_manage_tree,
        is_suspended: perms.is_suspended ?? false,
        granted_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      const resFull = await supabase
        .from('family_tree_permissions')
        .upsert(fullPayload, { onConflict: 'tree_id,user_id' });

      permErr = resFull.error;

      // 2. If database schema has not been updated with granular columns, fall back to base permission_level
      if (
        permErr &&
        (permErr.message?.includes('column') ||
         permErr.message?.includes('schema cache') ||
         permErr.code === 'PGRST204' ||
         permErr.details?.includes('column'))
      ) {
        console.warn('Granular columns not found in database schema. Falling back to base permission_level.', permErr);
        const resFallback = await supabase
          .from('family_tree_permissions')
          .upsert(
            {
              tree_id: targetTree.id,
              user_id: targetUser.id,
              permission_level: legacyLevel,
              granted_by: user?.id,
            },
            { onConflict: 'tree_id,user_id' }
          );
        permErr = resFallback.error;
      }

      if (permErr) throw permErr;

      // If linked to an access request, approve it
      if (requestIdToApprove) {
        const { error: reqErr } = await supabase
          .from('tree_access_requests')
          .update({
            status: 'approved',
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', requestIdToApprove);

        if (reqErr) {
          console.warn('Could not update request status:', reqErr);
        }
      }

      // Log to admin audit log
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_id: user?.id,
          action: requestIdToApprove ? 'approve_access_request' : 'update_permissions',
          target_user_id: targetUser.id,
          tree_id: targetTree.id,
          details: {
            permissions: perms,
            tree_name: targetTree.name,
            user_name: targetUser.name,
            request_id: requestIdToApprove || null,
          },
        });
      } catch (logErr) {
        console.warn('Audit log write error:', logErr);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'حدث خطأ أثناء حفظ الصلاحيات');
    } finally {
      setSaving(false);
    }
  };

  const permissionItems = [
    {
      key: 'can_view_tree' as const,
      label: '1. عرض الشجرة',
      desc: 'يستطيع مشاهدة المخطط العام لشجرة العائلة وفروعها',
      icon: <Eye size={18} />,
      recommended: true,
    },
    {
      key: 'can_view_details' as const,
      label: '2. عرض بيانات الأشخاص',
      desc: 'يستطيع الضغط على اسم الشخص ومشاهدة تفاصيله كالولادة والزوج والأبناء',
      icon: <Shield size={18} />,
    },
    {
      key: 'can_add_members' as const,
      label: '3. إضافة أشخاص',
      desc: 'يستطيع إضافة أفراد جدد إلى الشجرة',
      icon: <UserPlus size={18} />,
    },
    {
      key: 'can_edit_members' as const,
      label: '4. تعديل البيانات',
      desc: 'يستطيع تعديل معلومات وبيانات الأشخاص الموجودين',
      icon: <Edit3 size={18} />,
    },
    {
      key: 'can_manage_relations' as const,
      label: '5. إدارة العلاقات العائلية',
      desc: 'يستطيع ربط الأشخاص بالآباء والأمهات والأزواج والأبناء',
      icon: <Network size={18} />,
    },
    {
      key: 'can_delete_members' as const,
      label: '6. حذف الأشخاص',
      desc: 'يستطيع حذف الأفراد إذا سمح له الأدمن بذلك',
      icon: <Trash2 size={18} />,
      danger: true,
    },
    {
      key: 'can_manage_tree' as const,
      label: '7. إدارة الشجرة',
      desc: 'يستطيع إدارة إعدادات الشجرة وأعضائها وصلاحياتها بالكامل',
      icon: <Settings size={18} />,
      danger: true,
    },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-slideUp" style={{ maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: '#dbeafe', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.2rem', margin: 0 }}>
                تحديد صلاحيات المستخدم
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Granular Permissions Setup
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
            {error && (
              <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif', marginBottom: 16 }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Target Info Header */}
            <div style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 16,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>المستخدم:</span>
                <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '0.95rem' }}>
                  {targetUser.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', direction: 'ltr', textAlign: 'right' }}>
                  {targetUser.email}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>الشجرة المستهدفة:</span>
                <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                  {targetTree.name}
                </span>
              </div>
            </div>

            {/* Quick Access Type Selector (اختيار نوع التصريح) */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#1e3a8a', display: 'block', marginBottom: 8 }}>
                اختر نوع التصريح المطلوب منحه لهذا المستخدم:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {/* 1. Viewer */}
                <button
                  type="button"
                  onClick={() => applyPreset('viewer')}
                  style={{
                    border: currentRole === 'viewer' ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                    background: currentRole === 'viewer' ? '#eff6ff' : '#ffffff',
                    padding: '12px 8px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: currentRole === 'viewer' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Eye size={22} color={currentRole === 'viewer' ? '#1d4ed8' : '#64748b'} />
                  <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '0.86rem', color: currentRole === 'viewer' ? '#1d4ed8' : '#0f172a' }}>
                    👁️ مشاهدة فقط
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.3 }}>
                    قراءة الشجرة دون تعديل
                  </span>
                </button>

                {/* 2. Editor */}
                <button
                  type="button"
                  onClick={() => applyPreset('editor')}
                  style={{
                    border: currentRole === 'editor' ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                    background: currentRole === 'editor' ? '#eff6ff' : '#ffffff',
                    padding: '12px 8px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: currentRole === 'editor' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Edit3 size={22} color={currentRole === 'editor' ? '#1d4ed8' : '#64748b'} />
                  <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '0.86rem', color: currentRole === 'editor' ? '#1d4ed8' : '#0f172a' }}>
                    ✏️ محرر ومساهم
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.3 }}>
                    إضافة وتعديل الأبناء
                  </span>
                </button>

                {/* 3. Tree Admin */}
                <button
                  type="button"
                  onClick={() => applyPreset('admin')}
                  style={{
                    border: currentRole === 'admin' ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                    background: currentRole === 'admin' ? '#eff6ff' : '#ffffff',
                    padding: '12px 8px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: currentRole === 'admin' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Settings size={22} color={currentRole === 'admin' ? '#1d4ed8' : '#64748b'} />
                  <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '0.86rem', color: currentRole === 'admin' ? '#1d4ed8' : '#0f172a' }}>
                    👑 مسؤول الشجرة
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.3 }}>
                    صلاحيات وإدارة كاملة
                  </span>
                </button>
              </div>
            </div>

            {/* Granular Permission Checklist Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>
                تخصيص الصلاحيات الفردية (اختياري):
              </span>
            </div>

            {/* Granular Permission Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {permissionItems.map(item => {
                const active = !!perms[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => togglePerm(item.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: active
                        ? item.danger
                          ? '1px solid #f87171'
                          : '1px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                      background: active
                        ? item.danger
                          ? '#fef2f2'
                          : 'rgba(26, 86, 219, 0.04)'
                        : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Checkbox Icon */}
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        border: active
                          ? item.danger
                            ? '2px solid #ef4444'
                            : '2px solid var(--color-primary)'
                          : '2px solid var(--color-border)',
                        background: active
                          ? item.danger
                            ? '#ef4444'
                            : 'var(--color-primary)'
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        flexShrink: 0,
                      }}
                    >
                      {active && <Check size={14} strokeWidth={3} />}
                    </div>

                    {/* Icon */}
                    <div style={{
                      color: active
                        ? item.danger ? '#dc2626' : 'var(--color-primary)'
                        : 'var(--color-text-muted)',
                      flexShrink: 0
                    }}>
                      {item.icon}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'Tajawal, sans-serif',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: active
                          ? item.danger ? '#991b1b' : 'var(--color-text-main)'
                          : 'var(--color-text-muted)'
                      }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontFamily: 'Tajawal, sans-serif',
                        fontSize: '0.78rem',
                        color: 'var(--color-text-muted)',
                        marginTop: 2
                      }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Suspend Toggle Section */}
            <div style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 14,
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: perms.is_suspended ? '#fff7ed' : 'transparent',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: perms.is_suspended ? '1px solid #fdba74' : '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {perms.is_suspended ? (
                  <PauseCircle size={22} color="#ea580c" />
                ) : (
                  <PlayCircle size={22} color="var(--color-text-muted)" />
                )}
                <div>
                  <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: perms.is_suspended ? '#9a3412' : 'var(--color-text-main)' }}>
                    تعليق وصول المستخدم مؤقتاً
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                    يمنع المستخدم مؤقتاً من فتح الشجرة دون حذف صلاحياته المحددة
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${perms.is_suspended ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setPerms(prev => ({ ...prev, is_suspended: !prev.is_suspended }))}
                style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.8rem' }}
              >
                {perms.is_suspended ? 'إلغاء التعليق (تفعيل)' : 'تعليق الوصول'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', padding: '12px 24px' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ fontFamily: 'Tajawal, sans-serif', minWidth: 140 }}
            >
              {saving ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  جاري الحفظ...
                </>
              ) : (
                'حفظ وتفعيل الصلاحيات'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
