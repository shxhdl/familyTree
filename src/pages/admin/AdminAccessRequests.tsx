import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import PermissionsModal from '@/components/PermissionsModal';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  TreePine,
  User,
  AlertCircle,
  MessageSquare,
  Check,
  X,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { TreeAccessRequest, FamilyTree } from '@/types';

export default function AdminAccessRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TreeAccessRequest[]>([]);
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [treeFilter, setTreeFilter] = useState<string>('all');
  const [actionError, setActionError] = useState('');

  // Approval modal state
  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<TreeAccessRequest | null>(null);

  // Rejection modal state
  const [rejectingRequest, setRejectingRequest] = useState<TreeAccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Revocation state (for removing approved permissions)
  const [revokingRequest, setRevokingRequest] = useState<TreeAccessRequest | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setActionError('');
    try {
      // 1. Load active family trees
      const { data: treesData } = await supabase
        .from('family_trees')
        .select('id, name_ar, name_en')
        .order('name_ar');
      setTrees((treesData || []) as FamilyTree[]);

      // 2. Load access requests
      const { data: reqsData, error: reqsErr } = await supabase
        .from('tree_access_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (reqsErr) {
        console.warn('Could not load access requests:', reqsErr.message);
        setRequests([]);
        setLoading(false);
        return;
      }

      // Enrich with profile and tree info
      const enriched: TreeAccessRequest[] = [];
      for (const req of (reqsData || []) as TreeAccessRequest[]) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', req.user_id)
          .maybeSingle();

        const { data: tree } = await supabase
          .from('family_trees')
          .select('id, name_ar, name_en, created_by, visibility')
          .eq('id', req.tree_id)
          .maybeSingle();

        let creatorProfile = null;
        if (tree?.created_by) {
          const { data: cProf } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', tree.created_by)
            .maybeSingle();
          creatorProfile = cProf;
        }

        enriched.push({
          ...req,
          profile: prof as any,
          tree: tree ? { ...tree, creatorProfile } as any : undefined,
        });
      }

      setRequests(enriched);
    } catch (err: any) {
      console.error(err);
      setActionError('فشل تحميل طلبات الوصول: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest) return;
    setIsRejecting(true);
    setActionError('');

    try {
      const { error: updErr } = await supabase
        .from('tree_access_requests')
        .update({
          status: 'rejected',
          admin_note: rejectReason.trim() || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', rejectingRequest.id);

      if (updErr) throw updErr;

      // Log to audit log
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_id: user?.id,
          action: 'reject_access_request',
          target_user_id: rejectingRequest.user_id,
          tree_id: rejectingRequest.tree_id,
          details: {
            request_id: rejectingRequest.id,
            reason: rejectReason,
            tree_name: rejectingRequest.tree?.name_ar,
          },
        });
      } catch (logErr) {
        console.warn('Audit error:', logErr);
      }

      setRejectingRequest(null);
      setRejectReason('');
      loadData();
    } catch (err: any) {
      setActionError('خطأ أثناء رفض الطلب: ' + err.message);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokingRequest) return;
    setIsRevoking(true);
    setActionError('');
    try {
      // 1. Delete from family_tree_permissions
      const { error: permErr } = await supabase
        .from('family_tree_permissions')
        .delete()
        .eq('tree_id', revokingRequest.tree_id)
        .eq('user_id', revokingRequest.user_id);

      if (permErr) throw permErr;

      // 2. Update request status to rejected with admin note
      const { error: reqErr } = await supabase
        .from('tree_access_requests')
        .update({
          status: 'rejected',
          admin_note: 'تم سحب وإلغاء التصريح من قبل مدير النظام',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', revokingRequest.id);

      if (reqErr) throw reqErr;

      // 3. Log to audit logs
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_id: user?.id,
          action: 'revoke_tree_access',
          target_user_id: revokingRequest.user_id,
          tree_id: revokingRequest.tree_id,
          details: {
            request_id: revokingRequest.id,
            tree_name: revokingRequest.tree?.name_ar,
            user_name: revokingRequest.profile?.full_name,
          },
        });
      } catch (logErr) {
        console.warn('Audit error:', logErr);
      }

      setRevokingRequest(null);
      loadData();
    } catch (err: any) {
      setActionError('خطأ أثناء إزالة الصلاحية: ' + err.message);
    } finally {
      setIsRevoking(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesTree = treeFilter === 'all' || req.tree_id === treeFilter;
      const userName = req.profile?.full_name?.toLowerCase() || '';
      const userEmail = req.profile?.email?.toLowerCase() || '';
      const treeName = req.tree?.name_ar?.toLowerCase() || '';
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        userName.includes(searchLower) ||
        userEmail.includes(searchLower) ||
        treeName.includes(searchLower);

      return matchesStatus && matchesTree && matchesSearch;
    });
  }, [requests, statusFilter, treeFilter, search]);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> قيد المراجعة
          </span>
        );
      case 'approved':
        return (
          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} /> مقبول
          </span>
        );
      case 'rejected':
        return (
          <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={12} /> مرفوض
          </span>
        );
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <AdminLayout title="طلبات الوصول" subtitle="Access Requests Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Top Summary Banner */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-md)',
              background: '#dbeafe', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={22} />
            </div>
            <div>
              <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '1.1rem' }}>
                نظام إدارة طلبات الوصول
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
                قبول الطلبات مع تحديد الصلاحيات بدقة، أو رفضها لحماية خصوصية أشجار العائلة
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: pendingCount > 0 ? '#fef3c7' : 'var(--color-surface-2)',
              padding: '8px 16px', borderRadius: 'var(--radius-full)',
              border: pendingCount > 0 ? '1px solid #fde68a' : '1px solid var(--color-border)'
            }}>
              <Clock size={16} color={pendingCount > 0 ? '#d97706' : 'var(--color-text-muted)'} />
              <span style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.875rem', fontWeight: 600 }}>
                {pendingCount} طلبات معلقة بانتظار الموافقة
              </span>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              title="تحديث البيانات"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={14} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {actionError && (
          <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        {/* Filters and Search Bar */}
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
          {/* Search */}
          <div className="search-bar" style={{ minWidth: 260, flex: '1 1 260px' }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="ابحث بمقدم الطلب، البريد، أو الشجرة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="search-requests"
            />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={15} color="var(--color-text-muted)" />
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: 140, padding: '6px 12px' }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                id="filter-status"
              >
                <option value="all">كل الحالات ({requests.length})</option>
                <option value="pending">قيد المراجعة ({requests.filter(r => r.status === 'pending').length})</option>
                <option value="approved">مقبول ({requests.filter(r => r.status === 'approved').length})</option>
                <option value="rejected">مرفوض ({requests.filter(r => r.status === 'rejected').length})</option>
              </select>
            </div>

            {/* Tree Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: 160, padding: '6px 12px' }}
              value={treeFilter}
              onChange={e => setTreeFilter(e.target.value)}
              id="filter-tree"
            >
              <option value="all">كل الأشجار</option>
              {trees.map(t => (
                <option key={t.id} value={t.id}>{t.name_ar}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="loading-center" style={{ minHeight: 250 }}>
            <div className="spinner" />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>جاري تحميل طلبات الوصول...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📬</div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {search || statusFilter !== 'all' || treeFilter !== 'all'
                ? 'لا توجد طلبات مطابقة للبحث أو التصفية'
                : 'لا توجد طلبات وصول حتى الآن'}
            </h3>
            <p style={{ fontFamily: 'Tajawal, sans-serif' }}>
              عندما يقدم الزوار أو أفراد العائلة طلبات وصول للأشجار، ستظهر هنا فوراً.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>مقدم الطلب</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>شجرة العائلة</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>تاريخ الطلب</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>ملاحظة الطلب</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الحالة</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif', textAlign: 'center' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => {
                  const applicantName = req.profile?.full_name || 'مستخدم غير معروف';
                  const applicantEmail = req.profile?.email || '—';
                  const treeName = req.tree?.name_ar || 'شجرة غير محددة';

                  return (
                    <tr key={req.id}>
                      {/* Submitter */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--color-surface-2)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)'
                          }}>
                            {applicantName.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                              {applicantName}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', direction: 'ltr', textAlign: 'right' }}>
                              {applicantEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tree */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <TreePine size={16} color="var(--color-primary)" />
                            <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>
                              {treeName}
                            </span>
                          </div>
                          {Boolean(req.tree?.created_by && req.tree?.visibility === 'private') && (
                            <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700, fontFamily: 'Tajawal, sans-serif' }}>
                              🔒 شجرة خاصة بالعضو: {(req.tree as any)?.creatorProfile?.full_name || 'المنشئ'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {new Date(req.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Note */}
                      <td style={{ maxWidth: 220 }}>
                        {req.request_note ? (
                          <div style={{
                            fontSize: '0.82rem',
                            fontFamily: 'Tajawal, sans-serif',
                            color: 'var(--color-text-main)',
                            background: 'var(--color-surface-2)',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            lineHeight: 1.4,
                          }}>
                            {req.request_note}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                        {req.admin_note && (
                          <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: 4 }}>
                            رد الإدارة: {req.admin_note}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td>{getStatusBadge(req.status)}</td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                          {req.status === 'pending' ? (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => setSelectedRequestForApproval(req)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Tajawal, sans-serif', padding: '6px 12px' }}
                                id={`approve-req-${req.id}`}
                              >
                                <Check size={14} />
                                <span>قبول وتحديد الصلاحيات</span>
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setRejectingRequest(req);
                                  setRejectReason('');
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)' }}
                                id={`reject-req-${req.id}`}
                              >
                                <X size={14} />
                                <span>رفض</span>
                              </button>
                            </>
                          ) : req.status === 'approved' ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setSelectedRequestForApproval(req)}
                                style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.8rem' }}
                              >
                                تعديل الصلاحيات
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setRevokingRequest(req)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'Tajawal, sans-serif', fontSize: '0.8rem', padding: '4px 8px' }}
                                title="إزالة العضو من الصلاحيات وسحب التصريح"
                              >
                                <Trash2 size={13} />
                                <span>إزالة الصلاحية</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setSelectedRequestForApproval(req)}
                              style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.8rem' }}
                            >
                              إعادة النظر والقبول
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Granular Permissions Modal on Approval */}
      {selectedRequestForApproval && (
        <PermissionsModal
          isOpen={true}
          onClose={() => setSelectedRequestForApproval(null)}
          onSuccess={() => {
            setSelectedRequestForApproval(null);
            loadData();
          }}
          targetUser={{
            id: selectedRequestForApproval.user_id,
            name: selectedRequestForApproval.profile?.full_name || 'مستخدم',
            email: selectedRequestForApproval.profile?.email || '',
          }}
          targetTree={{
            id: selectedRequestForApproval.tree_id,
            name: selectedRequestForApproval.tree?.name_ar || 'شجرة العائلة',
          }}
          requestIdToApprove={selectedRequestForApproval.id}
        />
      )}

      {/* Reject Confirmation Modal */}
      {rejectingRequest && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRejectingRequest(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)' }}>
                رفض طلب الوصول
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setRejectingRequest(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRejectConfirm}>
              <div className="modal-body">
                <p style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  هل أنت متأكد من رفض طلب الوصول المقدم من{' '}
                  <strong>{rejectingRequest.profile?.full_name || 'هذا المستخدم'}</strong> للشجرة{' '}
                  <strong>{rejectingRequest.tree?.name_ar}</strong>؟
                </p>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label" htmlFor="reject-reason" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    سبب الرفض (اختياري، يظهر للمستخدم):
                  </label>
                  <textarea
                    id="reject-reason"
                    className="form-textarea"
                    rows={2}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="مثال: الشجرة مخصصة لأفراد الفرع المباشر فقط..."
                    style={{ fontFamily: 'Tajawal, sans-serif' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRejectingRequest(null)}
                  disabled={isRejecting}
                  style={{ fontFamily: 'Tajawal, sans-serif' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={isRejecting}
                  style={{ fontFamily: 'Tajawal, sans-serif' }}
                >
                  {isRejecting ? 'جاري الرفض...' : 'تأكيد الرفض'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Permission Confirmation Modal */}
      {revokingRequest && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRevokingRequest(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={20} />
                <span>إزالة وسحب الصلاحية</span>
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setRevokingRequest(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.95rem', lineHeight: 1.6 }}>
                هل أنت متأكد من <strong>سحب وإزالة صلاحية الوصول</strong> للشجرة{' '}
                <strong style={{ color: 'var(--color-primary)' }}>{revokingRequest.tree?.name_ar}</strong> من العضو{' '}
                <strong>{revokingRequest.profile?.full_name || 'هذا المستخدم'}</strong>؟
              </p>
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
                marginTop: 12, color: '#991b1b', fontSize: '0.85rem', fontFamily: 'Tajawal, sans-serif'
              }}>
                ⚠️ بمجرد التأكيد، ستعود الشجرة مقفلة فوراً في حساب العضو ولن يتمكن من الدخول إليها إلا بتقديم طلب جديد وموافقتك عليه.
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRevokingRequest(null)}
                disabled={isRevoking}
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRevokeConfirm}
                disabled={isRevoking}
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                {isRevoking ? 'جاري السحب...' : 'تأكيد إزالة الصلاحية'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
