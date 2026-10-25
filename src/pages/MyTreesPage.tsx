import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import PermissionsModal from '@/components/PermissionsModal';
import ImageUploadInput from '@/components/ImageUploadInput';
import {
  TreePine,
  Plus,
  Globe,
  Lock,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  ChevronRight,
  Trash2,
  AlertCircle,
  Crown,
  Key,
  UserCheck,
  ShieldAlert,
  Search,
  Filter,
  Eye,
  MessageSquare,
  Shield,
  Send,
} from 'lucide-react';
import type { FamilyTree, TreeAccessRequest } from '@/types';

interface PermittedUserRow {
  id: string; // permission row id
  tree_id: string;
  user_id: string;
  permission_level: 'viewer' | 'contributor' | 'admin';
  can_view_tree: boolean;
  can_view_details: boolean;
  can_add_members: boolean;
  can_edit_members: boolean;
  can_manage_relations: boolean;
  can_delete_members: boolean;
  can_manage_tree: boolean;
  is_suspended: boolean;
  granted_at: string;
  profile?: {
    full_name: string;
    email: string;
  };
  tree?: {
    id: string;
    name_ar: string;
  };
}

export default function MyTreesPage() {
  const { user, authUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab
  const initialTab = (searchParams.get('tab') as any) || 'owned';
  const [activeTab, setActiveTab] = useState<'owned' | 'requests' | 'perms' | 'accessible'>(initialTab);

  // Filter tree ID from URL or dropdown
  const [filterTreeId, setFilterTreeId] = useState<string>(searchParams.get('treeId') || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Trees State
  const [createdTrees, setCreatedTrees] = useState<FamilyTree[]>([]);
  const [accessibleTrees, setAccessibleTrees] = useState<FamilyTree[]>([]);
  const [loading, setLoading] = useState(true);

  // Access Requests & Permissions State
  const [treeRequests, setTreeRequests] = useState<TreeAccessRequest[]>([]);
  const [treePermissions, setTreePermissions] = useState<PermittedUserRow[]>([]);

  // Create Tree Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeNameEn, setNewTreeNameEn] = useState('');
  const [newTreeDesc, setNewTreeDesc] = useState('');
  const [newTreeCover, setNewTreeCover] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Publish Request Modal state
  const [treeToPublish, setTreeToPublish] = useState<FamilyTree | null>(null);
  const [publishNote, setPublishNote] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Delete tree confirmation
  const [treeToDelete, setTreeToDelete] = useState<FamilyTree | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permissions Modal state (for approving access requests)
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedTargetUser, setSelectedTargetUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [selectedTargetTree, setSelectedTargetTree] = useState<{ id: string; name: string } | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(undefined);

  // Reject Access Request state
  const [requestToReject, setRequestToReject] = useState<TreeAccessRequest | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Revoke Permission state
  const [permToRevoke, setPermToRevoke] = useState<PermittedUserRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    if (user) {
      loadMyTrees();
    }
  }, [user]);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['owned', 'requests', 'perms', 'accessible'].includes(tab)) {
      setActiveTab(tab as any);
    }
    const tId = searchParams.get('treeId');
    if (tId) {
      setFilterTreeId(tId);
    }
  }, [searchParams]);

  const loadMyTrees = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Load trees created by the user
      const { data: myOwned, error: ownedErr } = await supabase
        .from('family_trees')
        .select(`*, family_tree_members(count)`)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (ownedErr) console.warn('Owned trees error:', ownedErr);

      const formattedOwned = (myOwned || []).map((t: any) => ({
        ...t,
        member_count: t.family_tree_members?.[0]?.count ?? 0,
        is_owner: true,
        has_access: true,
      }));
      setCreatedTrees(formattedOwned as FamilyTree[]);

      const myTreeIds = formattedOwned.map(t => t.id);

      // 2. Load other trees where user has permissions (not owned)
      const { data: perms } = await supabase
        .from('family_tree_permissions')
        .select('tree_id, permission_level, can_view_tree, is_suspended')
        .eq('user_id', user.id)
        .eq('is_suspended', false);

      const otherTreeIds = (perms || [])
        .map(p => p.tree_id)
        .filter(tid => !myTreeIds.includes(tid));

      if (otherTreeIds.length > 0) {
        const { data: otherTreesData } = await supabase
          .from('family_trees')
          .select(`*, family_tree_members(count)`)
          .in('id', otherTreeIds);

        const formattedAccessible = (otherTreesData || []).map((t: any) => ({
          ...t,
          member_count: t.family_tree_members?.[0]?.count ?? 0,
          is_owner: false,
          has_access: true,
        }));
        setAccessibleTrees(formattedAccessible as FamilyTree[]);
      } else {
        setAccessibleTrees([]);
      }

      // 3. Load access requests for the trees created by this user
      if (myTreeIds.length > 0) {
        const { data: reqsData, error: reqsErr } = await supabase
          .from('tree_access_requests')
          .select('*')
          .in('tree_id', myTreeIds)
          .order('created_at', { ascending: false });

        if (reqsErr) {
          console.warn('Could not load access requests:', reqsErr.message);
          setTreeRequests([]);
        } else {
          const enrichedReqs: TreeAccessRequest[] = [];
          for (const req of (reqsData || []) as TreeAccessRequest[]) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('user_id', req.user_id)
              .maybeSingle();

            const tree = formattedOwned.find(t => t.id === req.tree_id);
            enrichedReqs.push({
              ...req,
              profile: prof as any,
              tree: tree ? { id: tree.id, name_ar: tree.name_ar, name_en: tree.name_en } as any : undefined,
            });
          }
          setTreeRequests(enrichedReqs);
        }

        // 4. Load permissions granted to other members on user's trees
        const { data: grantedPermsData, error: permsErr } = await supabase
          .from('family_tree_permissions')
          .select('*')
          .in('tree_id', myTreeIds)
          .neq('user_id', user.id);

        if (permsErr) {
          console.warn('Could not load tree permissions:', permsErr.message);
          setTreePermissions([]);
        } else {
          const enrichedPerms: PermittedUserRow[] = [];
          for (const p of grantedPermsData || []) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('user_id', p.user_id)
              .maybeSingle();

            const tree = formattedOwned.find(t => t.id === p.tree_id);
            enrichedPerms.push({
              ...p,
              profile: prof || undefined,
              tree: tree ? { id: tree.id, name_ar: tree.name_ar } : undefined,
            });
          }
          setTreePermissions(enrichedPerms);
        }
      } else {
        setTreeRequests([]);
        setTreePermissions([]);
      }
    } catch (err) {
      console.error('Error loading my trees and requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newTreeName.trim()) {
      setCreateError('يرجى كتابة اسم الشجرة بالعربية');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      const payload: any = {
        name_ar: newTreeName.trim(),
        name_en: newTreeNameEn.trim() || '',
        description_ar: newTreeDesc.trim() || null,
        cover_image_url: newTreeCover.trim() || null,
        status: 'active',
        created_by: user.id,
        visibility: 'private',
        publish_status: 'draft',
      };

      const { data: newTree, error: insErr } = await supabase
        .from('family_trees')
        .insert(payload)
        .select()
        .single();

      if (insErr) throw insErr;

      // Automatically add full owner permissions in family_tree_permissions
      try {
        await supabase.from('family_tree_permissions').upsert({
          tree_id: newTree.id,
          user_id: user.id,
          permission_level: 'admin',
          can_view_tree: true,
          can_view_details: true,
          can_add_members: true,
          can_edit_members: true,
          can_manage_relations: true,
          can_delete_members: true,
          can_manage_tree: true,
          is_suspended: false,
        });
      } catch (pErr) {
        console.warn('Auto perm error:', pErr);
      }

      setShowCreateModal(false);
      setNewTreeName('');
      setNewTreeNameEn('');
      setNewTreeDesc('');
      setNewTreeCover('');
      loadMyTrees();

      navigate(`/trees/${newTree.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'حدث خطأ أثناء إنشاء الشجرة');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendPublishRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treeToPublish) return;

    setIsPublishing(true);
    setPublishError('');

    try {
      const { error: updErr } = await supabase
        .from('family_trees')
        .update({
          publish_status: 'pending_approval',
          publish_request_note: publishNote.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', treeToPublish.id);

      if (updErr) throw updErr;

      setTreeToPublish(null);
      setPublishNote('');
      loadMyTrees();
    } catch (err: any) {
      setPublishError(err.message || 'حدث خطأ أثناء إرسال طلب النشر');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteTree = async () => {
    if (!treeToDelete) return;
    setIsDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('family_trees')
        .delete()
        .eq('id', treeToDelete.id);

      if (delErr) throw delErr;
      setTreeToDelete(null);
      loadMyTrees();
    } catch (err: any) {
      alert('خطأ أثناء حذف الشجرة: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Permissions Modal for approving access request
  const handleOpenApproveModal = (req: TreeAccessRequest) => {
    setSelectedTargetUser({
      id: req.user_id,
      name: req.profile?.full_name || 'عضو مسجل',
      email: req.profile?.email || '',
    });
    setSelectedTargetTree({
      id: req.tree_id,
      name: req.tree?.name_ar || 'الشجرة العائلية',
    });
    setSelectedRequestId(req.id);
    setIsPermModalOpen(true);
  };

  // Reject Access Request
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestToReject) return;

    setIsRejecting(true);
    try {
      const { error: rejErr } = await supabase
        .from('tree_access_requests')
        .update({
          status: 'rejected',
          admin_note: rejectionNote.trim() || 'تم رفض طلب الدخول من قبل منشئ الشجرة',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestToReject.id);

      if (rejErr) throw rejErr;

      setActionSuccess(`تم رفض طلب العضو ${requestToReject.profile?.full_name || ''} بنجاح`);
      setTimeout(() => setActionSuccess(''), 4000);
      setRequestToReject(null);
      setRejectionNote('');
      loadMyTrees();
    } catch (err: any) {
      alert('خطأ أثناء رفض الطلب: ' + err.message);
    } finally {
      setIsRejecting(false);
    }
  };

  // Revoke Permission from permitted user
  const handleConfirmRevoke = async () => {
    if (!permToRevoke) return;

    setIsRevoking(true);
    try {
      // 1. Delete row from family_tree_permissions
      const { error: delErr } = await supabase
        .from('family_tree_permissions')
        .delete()
        .eq('id', permToRevoke.id);

      if (delErr) throw delErr;

      // 2. Update access request status if exists
      await supabase
        .from('tree_access_requests')
        .update({
          status: 'rejected',
          admin_note: 'تم إلغاء وسحب التصريح من قبل منشئ الشجرة',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('tree_id', permToRevoke.tree_id)
        .eq('user_id', permToRevoke.user_id);

      setActionSuccess(`تم سحب وإلغاء تصريح الدخول للعضو ${permToRevoke.profile?.full_name || ''} بنجاح`);
      setTimeout(() => setActionSuccess(''), 4000);
      setPermToRevoke(null);
      loadMyTrees();
    } catch (err: any) {
      alert('خطأ أثناء إلغاء الصلاحية: ' + err.message);
    } finally {
      setIsRevoking(false);
    }
  };

  // Filter requests
  const pendingRequests = useMemo(() => {
    return treeRequests.filter(r => r.status === 'pending');
  }, [treeRequests]);

  const filteredRequests = useMemo(() => {
    return treeRequests.filter(r => {
      const matchTree = filterTreeId === 'all' || r.tree_id === filterTreeId;
      const userName = (r.profile?.full_name || '').toLowerCase();
      const userEmail = (r.profile?.email || '').toLowerCase();
      const treeName = (r.tree?.name_ar || '').toLowerCase();
      const note = (r.request_note || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || userName.includes(q) || userEmail.includes(q) || treeName.includes(q) || note.includes(q);
      return matchTree && matchSearch;
    });
  }, [treeRequests, filterTreeId, searchQuery]);

  const filteredPerms = useMemo(() => {
    return treePermissions.filter(p => {
      const matchTree = filterTreeId === 'all' || p.tree_id === filterTreeId;
      const userName = (p.profile?.full_name || '').toLowerCase();
      const userEmail = (p.profile?.email || '').toLowerCase();
      const treeName = (p.tree?.name_ar || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || userName.includes(q) || userEmail.includes(q) || treeName.includes(q);
      return matchTree && matchSearch;
    });
  }, [treePermissions, filterTreeId, searchQuery]);

  const getPublishBadge = (tree: FamilyTree) => {
    const status = tree.publish_status || 'draft';
    if (status === 'published') {
      return (
        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Globe size={12} /> منشورة في المنصة العامة
        </span>
      );
    }
    if (status === 'pending_approval') {
      return (
        <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} /> بانتظار موافقة مدير النظام على النشر
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={tree.publish_rejection_reason || ''}>
          <XCircle size={12} /> تم رفض النشر العام
        </span>
      );
    }
    return (
      <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Lock size={12} /> خاصة بك فقط (مسودة)
      </span>
    );
  };

  const getPermissionLevelBadge = (level: string) => {
    if (level === 'admin') {
      return (
        <span style={{
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <Shield size={12} /> مدير للشجرة (كامل الصلاحيات)
        </span>
      );
    }
    if (level === 'contributor') {
      return (
        <span style={{
          background: '#f0fdf4',
          color: '#15803d',
          border: '1px solid #bbf7d0',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <UserCheck size={12} /> مساهم (إضافة وتعديل الأفراد)
        </span>
      );
    }
    return (
      <span style={{
        background: '#f8fafc',
        color: '#475569',
        border: '1px solid #cbd5e1',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.75rem',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <Eye size={12} /> مشاهد فقط (استعراض الشجرة)
      </span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />

      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2b5c 0%, #1a4fba 45%, #0284c7 100%)',
          color: 'white',
          padding: '40px 20px 36px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
        }}
      >
        <div className="container" style={{ maxWidth: 1040, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 'var(--radius-full)', marginBottom: 12, fontSize: '0.8rem' }}>
              <Crown size={14} color="#fde047" />
              <span style={{ fontFamily: 'Tajawal, sans-serif' }}>مساحتك العائلية الخاصة</span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, margin: '0 0 8px' }}>
              أشجاري العائلية
            </h1>
            <p style={{ fontFamily: 'Tajawal, sans-serif', opacity: 0.9, margin: 0, fontSize: '0.95rem', maxWidth: 580, lineHeight: 1.5 }}>
              أنشئ شجرة عائلتك الخاصة، وتحكّم بمن يدخل إليها، وامنح تصاريح الوصول للأعضاء الآخرين دون الحاجة لتدخل مدير النظام
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 22px',
              fontSize: '0.95rem',
              fontWeight: 700,
              background: '#2563eb',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            }}
          >
            <Plus size={18} />
            <span>إنشاء شجرة خاصة جديدة</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container" style={{ maxWidth: 1040, padding: '28px 20px 60px' }}>
        {/* Success Alert Banner */}
        {actionSuccess && (
          <div className="alert alert-success animate-fadeIn" style={{ marginBottom: 20, fontFamily: 'Tajawal, sans-serif' }}>
            <CheckCircle size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 24,
          overflowX: 'auto',
          paddingBottom: 2,
        }}>
          {/* Tab 1: Owned Trees */}
          <button
            type="button"
            onClick={() => { setActiveTab('owned'); setSearchParams({ tab: 'owned' }); }}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'owned' ? '#1d4ed8' : '#64748b',
              fontWeight: activeTab === 'owned' ? 800 : 600,
              fontFamily: 'Tajawal, sans-serif',
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'owned' ? '3px solid #1d4ed8' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <TreePine size={18} />
            <span>أشجاري الخاصة</span>
            <span style={{
              background: activeTab === 'owned' ? '#dbeafe' : '#f1f5f9',
              color: activeTab === 'owned' ? '#1e40af' : '#475569',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}>
              {createdTrees.length}
            </span>
          </button>

          {/* Tab 2: Access Requests */}
          <button
            type="button"
            onClick={() => { setActiveTab('requests'); setSearchParams({ tab: 'requests' }); }}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'requests' ? '#1d4ed8' : '#64748b',
              fontWeight: activeTab === 'requests' ? 800 : 600,
              fontFamily: 'Tajawal, sans-serif',
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'requests' ? '3px solid #1d4ed8' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Key size={18} color={pendingRequests.length > 0 ? '#d97706' : undefined} />
            <span>طلبات تصاريح الدخول</span>
            {pendingRequests.length > 0 ? (
              <span style={{
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706' }} />
                {pendingRequests.length} جديد
              </span>
            ) : (
              <span style={{
                background: '#f1f5f9',
                color: '#64748b',
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}>
                0
              </span>
            )}
          </button>

          {/* Tab 3: Permitted Members */}
          <button
            type="button"
            onClick={() => { setActiveTab('perms'); setSearchParams({ tab: 'perms' }); }}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'perms' ? '#1d4ed8' : '#64748b',
              fontWeight: activeTab === 'perms' ? 800 : 600,
              fontFamily: 'Tajawal, sans-serif',
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'perms' ? '3px solid #1d4ed8' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <UserCheck size={18} />
            <span>المصرح لهم بدخول أشجاري</span>
            <span style={{
              background: activeTab === 'perms' ? '#dbeafe' : '#f1f5f9',
              color: activeTab === 'perms' ? '#1e40af' : '#475569',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}>
              {treePermissions.length}
            </span>
          </button>

          {/* Tab 4: Accessible Trees */}
          <button
            type="button"
            onClick={() => { setActiveTab('accessible'); setSearchParams({ tab: 'accessible' }); }}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'accessible' ? '#1d4ed8' : '#64748b',
              fontWeight: activeTab === 'accessible' ? 800 : 600,
              fontFamily: 'Tajawal, sans-serif',
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'accessible' ? '3px solid #1d4ed8' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Lock size={18} />
            <span>أشجار مصرح لي بها</span>
            <span style={{
              background: activeTab === 'accessible' ? '#dbeafe' : '#f1f5f9',
              color: activeTab === 'accessible' ? '#1e40af' : '#475569',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}>
              {accessibleTrees.length}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="loading-center">
            <div className="spinner" />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>جاري تحميل البيانات...</span>
          </div>
        ) : (
          <div>
            {/* ======================================================== */}
            {/* TAB 1: OWNED TREES (أشجاري الخاصة) */}
            {/* ======================================================== */}
            {activeTab === 'owned' && (
              <div className="animate-fadeIn">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Crown size={20} color="var(--color-primary)" />
                      <span>الأشجار التي أنشأتها (أنت المسؤول عنها بالكامل)</span>
                    </h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                      أنت صاحب الشجرة وتملك كامل الصلاحيات لمنح أو رفض تصاريح الدخول للأعضاء الآخرين دون أي وسيط
                    </p>
                  </div>
                  <span className="badge badge-blue">{createdTrees.length} شجرة</span>
                </div>

                {createdTrees.length === 0 ? (
                  <div className="empty-state" style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '40px 20px' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eff6ff', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <TreePine size={28} />
                    </div>
                    <h3 style={{ fontFamily: 'Tajawal, sans-serif', margin: '0 0 8px' }}>لم تنشئ أي شجرة عائلية خاصة بعد</h3>
                    <p style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-text-muted)', maxWidth: 440, margin: '0 auto 20px' }}>
                      يمكنك الآن البدء بإنشاء شجرة عائلتك الخاصة بكل سهولة وإضافة أفراد عائلتك وحفظ أنسابهم
                    </p>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                      <Plus size={16} /> إنشاء شجرتك الأولى
                    </button>
                  </div>
                ) : (
                  <div className="grid-cards">
                    {createdTrees.map(tree => {
                      const isPublished = tree.publish_status === 'published';
                      const isPending = tree.publish_status === 'pending_approval';
                      const treePendingCount = pendingRequests.filter(r => r.tree_id === tree.id).length;
                      const treePermsCount = treePermissions.filter(p => p.tree_id === tree.id).length;

                      return (
                        <div key={tree.id} className="tree-card" style={{ display: 'flex', flexDirection: 'column' }}>
                          {/* Publish Status Badge */}
                          <div className="tree-card-status">
                            {getPublishBadge(tree)}
                          </div>

                          {/* Cover Image */}
                          {tree.cover_image_url ? (
                            <img src={tree.cover_image_url} alt={tree.name_ar} className="tree-card-cover" style={{ objectFit: 'cover' }} />
                          ) : (
                            <div className="tree-card-cover-placeholder">
                              <TreePine size={40} opacity={0.6} />
                            </div>
                          )}

                          {/* Body */}
                          <div className="tree-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 className="tree-card-title">{tree.name_ar}</h3>
                            {tree.name_en && <div className="tree-card-subtitle">{tree.name_en}</div>}
                            {tree.description_ar && (
                              <p className="tree-card-desc">{tree.description_ar}</p>
                            )}

                            {/* Pending Requests Alert Banner on Tree Card */}
                            {treePendingCount > 0 && (
                              <div
                                onClick={() => {
                                  setActiveTab('requests');
                                  setFilterTreeId(tree.id);
                                  setSearchParams({ tab: 'requests', treeId: tree.id });
                                }}
                                style={{
                                  background: '#fffbeb',
                                  border: '1.5px solid #fde68a',
                                  color: '#b45309',
                                  padding: '8px 12px',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginTop: 10,
                                  transition: 'background 0.15s ease',
                                }}
                                title="اضغط لمراجعة طلبات الدخول وقبولها"
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Key size={14} color="#d97706" />
                                  <span>يوجد {treePendingCount} طلب تصريح دخول جديد</span>
                                </span>
                                <span style={{ textDecoration: 'underline', color: '#1d4ed8' }}>مراجعة</span>
                              </div>
                            )}

                            {/* Footer with member count and actions */}
                            <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                  <Users size={15} />
                                  <span style={{ fontFamily: 'Tajawal, sans-serif' }}>{tree.member_count ?? 0} فرد</span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {/* Permitted Users Badge */}
                                  {treePermsCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTab('perms');
                                        setFilterTreeId(tree.id);
                                        setSearchParams({ tab: 'perms', treeId: tree.id });
                                      }}
                                      style={{
                                        background: '#f0fdf4',
                                        color: '#166534',
                                        border: '1px solid #bbf7d0',
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                      title="عرض الأعضاء المصرح لهم بدخول هذه الشجرة"
                                    >
                                      <UserCheck size={12} />
                                      <span>{treePermsCount} مصرح لهم</span>
                                    </button>
                                  )}

                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setTreeToDelete(tree)}
                                    style={{ color: 'var(--color-danger)', padding: 4 }}
                                    title="حذف الشجرة"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                <Link
                                  to={`/trees/${tree.id}`}
                                  className="btn btn-primary btn-sm"
                                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                >
                                  <span>فتح الشجرة</span>
                                  <ChevronRight size={15} />
                                </Link>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setActiveTab('requests');
                                    setFilterTreeId(tree.id);
                                    setSearchParams({ tab: 'requests', treeId: tree.id });
                                  }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontFamily: 'Tajawal, sans-serif' }}
                                  title="إدارة طلبات وتصاريح الدخول لهذه الشجرة"
                                >
                                  <Key size={14} />
                                  <span>التصاريح</span>
                                </button>

                                {!isPublished && (
                                  <button
                                    className={`btn btn-sm ${isPending ? 'btn-ghost' : 'btn-secondary'}`}
                                    onClick={() => setTreeToPublish(tree)}
                                    disabled={isPending}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      fontSize: '0.8rem',
                                      fontFamily: 'Tajawal, sans-serif',
                                    }}
                                    title="طلب نشر الشجرة لتظهر في الصفحة الرئيسية للجميع بعد موافقة الإدارة"
                                  >
                                    {isPending ? (
                                      <>
                                        <Clock size={13} color="#d97706" />
                                        <span style={{ color: '#d97706' }}>قيد المراجعة</span>
                                      </>
                                    ) : (
                                      <>
                                        <Globe size={13} />
                                        <span>طلب نشر عام</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: ACCESS REQUESTS (طلبات تصاريح الدخول لشجراتي) */}
            {/* ======================================================== */}
            {activeTab === 'requests' && (
              <div className="animate-fadeIn">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Key size={20} color="#d97706" />
                      <span>طلبات تصاريح الدخول لشجراتك العائلية</span>
                    </h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                      أنت المتحكم الوحيد في قبول أو رفض طلبات الدخول وتحديد نوع الصلاحية لكل عضو
                    </p>
                  </div>

                  {/* Filter by Tree */}
                  {createdTrees.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Filter size={16} color="var(--color-text-muted)" />
                      <select
                        className="form-control"
                        value={filterTreeId}
                        onChange={e => {
                          setFilterTreeId(e.target.value);
                          if (e.target.value === 'all') {
                            setSearchParams({ tab: 'requests' });
                          } else {
                            setSearchParams({ tab: 'requests', treeId: e.target.value });
                          }
                        }}
                        style={{ maxWidth: 220, fontSize: '0.85rem' }}
                      >
                        <option value="all">جميع أشجاري ({createdTrees.length})</option>
                        {createdTrees.map(t => (
                          <option key={t.id} value={t.id}>{t.name_ar}</option>
                        ))}
                      </select>

                      {filterTreeId !== 'all' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setFilterTreeId('all');
                            setSearchParams({ tab: 'requests' });
                          }}
                          style={{ fontSize: '0.8rem', padding: '4px 10px', fontFamily: 'Tajawal, sans-serif' }}
                        >
                          عرض كل الأشجار
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {filteredRequests.length === 0 ? (
                  <div className="empty-state" style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '48px 20px', textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Key size={28} />
                    </div>
                    <h3 style={{ fontFamily: 'Tajawal, sans-serif', margin: '0 0 8px' }}>
                      {filterTreeId !== 'all' && treeRequests.length > 0
                        ? 'لا توجد طلبات تصاريح لهذه الشجرة المحددة'
                        : 'لا توجد طلبات تصاريح معلقة حالياً'}
                    </h3>
                    <p style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-text-muted)', maxWidth: 460, margin: '0 auto' }}>
                      {filterTreeId !== 'all' && treeRequests.length > 0 ? (
                        <>
                          لديك ({treeRequests.length}) طلبات في أشجارك الأخرى.
                          <div style={{ marginTop: 12 }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setFilterTreeId('all');
                                setSearchParams({ tab: 'requests' });
                              }}
                            >
                              عرض جميع الطلبات ({treeRequests.length})
                            </button>
                          </div>
                        </>
                      ) : (
                        'عندما يقوم أي عضو مسجل في المنصة بطلب تصريح دخول إلى إحدى أشجارك، سيظهر طلبه هنا فوراً لتتمكن من قبوله وتحديد صلاحياته دون الحاجة لتدخل مدير النظام.'
                      )}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {filteredRequests.map(req => {
                      const isPending = req.status === 'pending';
                      const isApproved = req.status === 'approved';
                      const isRejected = req.status === 'rejected';

                      return (
                        <div
                          key={req.id}
                          className="card"
                          style={{
                            padding: '18px 20px',
                            border: isPending ? '1.5px solid #fde68a' : '1px solid var(--color-border)',
                            background: isPending ? '#fffdf7' : 'var(--color-surface)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                            {/* User details */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                background: isPending ? '#fef3c7' : '#eff6ff',
                                color: isPending ? '#b45309' : '#1d4ed8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '1.1rem',
                                flexShrink: 0,
                              }}>
                                {(req.profile?.full_name || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text-main)', fontFamily: 'Tajawal, sans-serif' }}>
                                  {req.profile?.full_name || 'عضو مسجل'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', direction: 'ltr', textAlign: 'right' }}>
                                  {req.profile?.email}
                                </div>
                              </div>
                            </div>

                            {/* Status & Tree Name */}
                            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TreePine size={14} color="#2563eb" />
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e40af' }}>
                                  {req.tree?.name_ar || 'الشجرة العائلية'}
                                </span>
                              </div>
                              <div>
                                {isPending && (
                                  <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={12} /> بانتظار موافقتك
                                  </span>
                                )}
                                {isApproved && (
                                  <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle size={12} /> تم قبول الطلب ومنح التصريح
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <XCircle size={12} /> تم رفض الطلب
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Request Note */}
                          {req.request_note && (
                            <div style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 'var(--radius-md)',
                              padding: '10px 14px',
                              fontSize: '0.85rem',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                            }}>
                              <MessageSquare size={16} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 2 }}>ملاحظة مقدم الطلب:</div>
                                <div>{req.request_note}</div>
                              </div>
                            </div>
                          )}

                          {/* Footer with date & actions */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 2, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                              تاريخ التقديم: {new Date(req.created_at).toLocaleDateString('ar-EG', { dateStyle: 'long' })}
                            </div>

                            {/* Action Buttons (Only for Pending requests) */}
                            {isPending && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleOpenApproveModal(req)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                                >
                                  <CheckCircle size={15} />
                                  <span>قبول ومنح الصلاحيات</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setRequestToReject(req)}
                                  style={{ color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <XCircle size={15} />
                                  <span>رفض</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: PERMITTED MEMBERS (المصرح لهم بدخول أشجاري) */}
            {/* ======================================================== */}
            {activeTab === 'perms' && (
              <div className="animate-fadeIn">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <UserCheck size={20} color="#16a34a" />
                      <span>الأعضاء المصرح لهم بدخول أشجاري</span>
                    </h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                      قائمة بالأعضاء الذين منحتهم تصاريح دخول إلى شجراتك، ويمكنك إلغاء أو سحب التصريح في أي وقت
                    </p>
                  </div>

                  {/* Filter by Tree */}
                  {createdTrees.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Filter size={16} color="var(--color-text-muted)" />
                      <select
                        className="form-control"
                        value={filterTreeId}
                        onChange={e => {
                          setFilterTreeId(e.target.value);
                          setSearchParams({ tab: 'perms', treeId: e.target.value });
                        }}
                        style={{ maxWidth: 220, fontSize: '0.85rem' }}
                      >
                        <option value="all">جميع أشجاري ({createdTrees.length})</option>
                        {createdTrees.map(t => (
                          <option key={t.id} value={t.id}>{t.name_ar}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {filteredPerms.length === 0 ? (
                  <div className="empty-state" style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '48px 20px', textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Users size={28} />
                    </div>
                    <h3 style={{ fontFamily: 'Tajawal, sans-serif', margin: '0 0 8px' }}>لا يوجد أعضاء مصرح لهم حالياً</h3>
                    <p style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-text-muted)', maxWidth: 460, margin: '0 auto' }}>
                      عندما تقبل طلبات دخول الأعضاء لشجراتك العائلية ستظهر أسماؤهم وصلاحياتهم هنا.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredPerms.map(perm => (
                      <div
                        key={perm.id}
                        className="card"
                        style={{
                          padding: '16px 20px',
                          borderRadius: 'var(--radius-lg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        {/* Member info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '1rem',
                            flexShrink: 0,
                          }}>
                            {(perm.profile?.full_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text-main)', fontFamily: 'Tajawal, sans-serif' }}>
                              {perm.profile?.full_name || 'عضو مسجل'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', direction: 'ltr', textAlign: 'right' }}>
                              {perm.profile?.email}
                            </div>
                          </div>
                        </div>

                        {/* Tree Name & Permission Level */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#1e40af', fontWeight: 700 }}>
                            <TreePine size={14} />
                            <span>{perm.tree?.name_ar || 'الشجرة العائلية'}</span>
                          </div>

                          <div>
                            {getPermissionLevelBadge(perm.permission_level)}
                          </div>

                          {/* Revoke Permission Button */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPermToRevoke(perm)}
                            style={{
                              color: '#dc2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 10px',
                              borderRadius: 'var(--radius-md)',
                              background: '#fef2f2',
                              border: '1px solid #fee2e2',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                            }}
                            title="سحب وإلغاء التصريح من هذا العضو"
                          >
                            <Trash2 size={13} />
                            <span>إلغاء الصلاحية</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: ACCESSIBLE TREES (أشجار مصرح لي بها من أعضاء آخرين) */}
            {/* ======================================================== */}
            {activeTab === 'accessible' && (
              <div className="animate-fadeIn">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lock size={20} color="#16a34a" />
                      <span>الأشجار العائلية المصرح لك بالدخول إليها</span>
                    </h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                      أشجار عائلية أنشأها أعضاء آخرون أو إدارة المنصة ومُنحت تصريحاً لتصفحها
                    </p>
                  </div>
                  <span className="badge badge-green">{accessibleTrees.length} شجرة</span>
                </div>

                {accessibleTrees.length === 0 ? (
                  <div className="empty-state" style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f8fafc', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Lock size={28} />
                    </div>
                    <h3 style={{ fontFamily: 'Tajawal, sans-serif', margin: '0 0 8px' }}>لا توجد أشجار أخرى مصرح لك بها حالياً</h3>
                    <p style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-text-muted)', maxWidth: 440, margin: '0 auto 16px' }}>
                      يمكنك استعراض الصفحة الرئيسية وتقديم طلب وصول لأي شجرة تود الاطلاع عليها
                    </p>
                    <Link to="/" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>تصفح الأشجار في الصفحة الرئيسية</span>
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                ) : (
                  <div className="grid-cards">
                    {accessibleTrees.map(tree => (
                      <div key={tree.id} className="tree-card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="tree-card-status">
                          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> مصرح لك بالوصول
                          </span>
                        </div>

                        {tree.cover_image_url ? (
                          <img src={tree.cover_image_url} alt={tree.name_ar} className="tree-card-cover" style={{ objectFit: 'cover' }} />
                        ) : (
                          <div className="tree-card-cover-placeholder">
                            <TreePine size={40} opacity={0.6} />
                          </div>
                        )}

                        <div className="tree-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <h3 className="tree-card-title">{tree.name_ar}</h3>
                          {tree.name_en && <div className="tree-card-subtitle">{tree.name_en}</div>}
                          {tree.description_ar && (
                            <p className="tree-card-desc">{tree.description_ar}</p>
                          )}

                          <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                <Users size={15} />
                                <span style={{ fontFamily: 'Tajawal, sans-serif' }}>{tree.member_count ?? 0} فرد</span>
                              </div>

                              <Link
                                to={`/trees/${tree.id}`}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                              >
                                <span>استعراض الشجرة</span>
                                <ChevronRight size={15} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: CREATE NEW TREE */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TreePine size={22} color="var(--color-primary)" />
                <span>إنشاء شجرة عائلية خاصة جديدة</span>
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateTree}>
              <div className="modal-body">
                {createError && (
                  <div className="alert alert-error" style={{ marginBottom: 14, fontFamily: 'Tajawal, sans-serif' }}>
                    <AlertCircle size={16} /> {createError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="tree-name-ar">
                    اسم الشجرة (بالعربية) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="tree-name-ar"
                    type="text"
                    className="form-input"
                    value={newTreeName}
                    onChange={e => setNewTreeName(e.target.value)}
                    placeholder="مثال: شجرة عائلة محمد صومار"
                    required
                    style={{ fontFamily: 'Tajawal, sans-serif' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tree-name-en">
                    اسم الشجرة (بالإنجليزية - اختياري)
                  </label>
                  <input
                    id="tree-name-en"
                    type="text"
                    className="form-input"
                    value={newTreeNameEn}
                    onChange={e => setNewTreeNameEn(e.target.value)}
                    placeholder="e.g. Mohammed Somar Family Tree"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tree-desc">
                    نبذة عن العائلة (اختياري)
                  </label>
                  <textarea
                    id="tree-desc"
                    className="form-textarea"
                    value={newTreeDesc}
                    onChange={e => setNewTreeDesc(e.target.value)}
                    placeholder="نبذة مختصرة عن نسب أو تاريخ العائلة..."
                    rows={3}
                    style={{ fontFamily: 'Tajawal, sans-serif' }}
                  />
                </div>

                <ImageUploadInput
                  value={newTreeCover}
                  onChange={setNewTreeCover}
                  label="صورة غلاف الشجرة (اختياري)"
                />

                <div style={{
                  background: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}>
                  🔒 <strong>شجرة خاصة بك:</strong> ستكون هذه الشجرة خاصة بمسودتك أنت فقط ومحفوظة بحسابك، ويمكنك إضافة الأفراد وبنائها كما تحب. إذا رغبت بنشرها في المنصة يمكنك طلب النشر لاحقاً.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={isCreating}>
                  {isCreating ? 'جاري الإنشاء...' : 'إنشاء الشجرة والبدء بإضافة الأفراد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: REQUEST PUBLIC PUBLISH */}
      {/* ======================================================== */}
      {treeToPublish && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTreeToPublish(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={20} color="var(--color-primary)" />
                <span>طلب نشر الشجرة في المنصة العامة</span>
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setTreeToPublish(null)}>✕</button>
            </div>

            <form onSubmit={handleSendPublishRequest}>
              <div className="modal-body">
                {publishError && (
                  <div className="alert alert-error" style={{ marginBottom: 14 }}>
                    <AlertCircle size={16} /> {publishError}
                  </div>
                )}

                <p style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--color-text-main)' }}>
                  سيتم إرسال طلب اعتماد نشر شجرة: <strong>{treeToPublish.name_ar}</strong> إلى مدير المنصة.
                  عند الموافقة، ستظهر بطاقة الشجرة لجميع الأعضاء والزوار في الصفحة الرئيسية.
                </p>

                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label" htmlFor="publish-note">
                    ملاحظة لمدير المنصة (اختياري)
                  </label>
                  <textarea
                    id="publish-note"
                    className="form-textarea"
                    value={publishNote}
                    onChange={e => setPublishNote(e.target.value)}
                    placeholder="مثال: تم تدقيق وتوثيق 4 أجيال من العائلة الكريمة وجاهزة للنشر..."
                    rows={3}
                    style={{ fontFamily: 'Tajawal, sans-serif' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setTreeToPublish(null)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPublishing}>
                  {isPublishing ? 'جاري الإرسال...' : 'إرسال طلب النشر للمدير'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: DELETE TREE CONFIRMATION */}
      {/* ======================================================== */}
      {treeToDelete && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTreeToDelete(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={20} />
                <span>تأكيد حذف الشجرة الخاصة</span>
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setTreeToDelete(null)}>✕</button>
            </div>

            <div className="modal-body">
              <p style={{ fontFamily: 'Tajawal, sans-serif', lineHeight: 1.6 }}>
                هل أنت متأكد من رغبتك في حذف شجرة <strong>{treeToDelete.name_ar}</strong>؟
              </p>
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                ⚠️ سيؤدي هذا الإجراء إلى حذف الشجرة وسجلاتها الخاصة نهائياً من حسابك.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTreeToDelete(null)}>
                إلغاء
              </button>
              <button className="btn btn-danger" onClick={handleDeleteTree} disabled={isDeleting}>
                {isDeleting ? 'جاري الحذف...' : 'نعم، احذف الشجرة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: REJECT ACCESS REQUEST */}
      {/* ======================================================== */}
      {requestToReject && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRequestToReject(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={20} />
                <span>رفض طلب تصريح الدخول</span>
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setRequestToReject(null)}>✕</button>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div className="modal-body">
                <p style={{ fontFamily: 'Tajawal, sans-serif', lineHeight: 1.6, margin: '0 0 12px' }}>
                  هل أنت متأكد من رفض طلب الدخول المقدم من: <strong>{requestToReject.profile?.full_name || 'هذا العضو'}</strong> لشجرة <strong>{requestToReject.tree?.name_ar}</strong>؟
                </p>

                <div className="form-group">
                  <label className="form-label" htmlFor="reject-note">
                    سبب الرفض (اختياري - يظهر للعضو)
                  </label>
                  <textarea
                    id="reject-note"
                    className="form-textarea"
                    value={rejectionNote}
                    onChange={e => setRejectionNote(e.target.value)}
                    placeholder="مثال: عذراً هذه الشجرة مخصصة لأفراد الفرع المباشر فقط..."
                    rows={3}
                    style={{ fontFamily: 'Tajawal, sans-serif' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRequestToReject(null)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-danger" disabled={isRejecting}>
                  {isRejecting ? 'جاري الرفض...' : 'تأكيد رفض الطلب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: REVOKE PERMISSION CONFIRMATION */}
      {/* ======================================================== */}
      {permToRevoke && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPermToRevoke(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={20} />
                <span>إلغاء وسحب تصريح الدخول</span>
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setPermToRevoke(null)}>✕</button>
            </div>

            <div className="modal-body">
              <p style={{ fontFamily: 'Tajawal, sans-serif', lineHeight: 1.6, margin: '0 0 12px' }}>
                هل أنت متأكد من رغبتك في سحب تصريح الدخول من العضو: <strong>{permToRevoke.profile?.full_name || 'هذا العضو'}</strong> لشجرة <strong>{permToRevoke.tree?.name_ar}</strong>؟
              </p>
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                ⚠️ بعد سحب التصريح، لن يتمكن هذا العضو من دخول شجرتك أو الاطلاع على تفاصيلها مجدداً إلا إذا قدّم طلباً جديداً ووافقت عليه.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPermToRevoke(null)}>
                إلغاء
              </button>
              <button className="btn btn-danger" onClick={handleConfirmRevoke} disabled={isRevoking}>
                {isRevoking ? 'جاري السحب...' : 'نعم، سحب وإلغاء التصريح'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: PERMISSIONS MODAL (Owner granting granular access) */}
      {/* ======================================================== */}
      {selectedTargetUser && selectedTargetTree && (
        <PermissionsModal
          isOpen={isPermModalOpen}
          onClose={() => {
            setIsPermModalOpen(false);
            setSelectedTargetUser(null);
            setSelectedTargetTree(null);
            setSelectedRequestId(undefined);
          }}
          onSuccess={() => {
            setActionSuccess(`تم منح تصريح الدخول للعضو ${selectedTargetUser.name} بنجاح!`);
            setTimeout(() => setActionSuccess(''), 4000);
            setIsPermModalOpen(false);
            setSelectedTargetUser(null);
            setSelectedTargetTree(null);
            setSelectedRequestId(undefined);
            loadMyTrees();
          }}
          targetUser={selectedTargetUser}
          targetTree={selectedTargetTree}
          requestIdToApprove={selectedRequestId}
        />
      )}
    </div>
  );
}
