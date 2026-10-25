import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { Check, X, Eye, Clock, CheckCircle, XCircle, Filter } from 'lucide-react';
import type { PendingSubmission, FamilyTree } from '@/types';

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [treeFilter, setTreeFilter] = useState('');
  const [viewing, setViewing] = useState<PendingSubmission | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, [filter, treeFilter]);

  const loadAll = async () => {
    setLoading(true);
    let query = supabase
      .from('pending_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);
    if (treeFilter) query = query.eq('tree_id', treeFilter);

    const { data } = await query;
    setSubmissions((data || []) as PendingSubmission[]);

    const { data: treesData } = await supabase.from('family_trees').select('id, name_ar').order('name_ar');
    setTrees((treesData || []) as FamilyTree[]);
    setLoading(false);
  };

  const approve = async (sub: PendingSubmission) => {
    setProcessing(sub.id);
    try {
      // Apply the change: insert person + link to tree
      const payload = sub.payload as any;
      if (sub.submission_type === 'add_member') {
        const { data: personData, error: personErr } = await supabase
          .from('persons')
          .insert({
            full_name_ar: payload.full_name_ar,
            full_name_en: payload.full_name_en || '',
            gender: payload.gender || 'male',
            birth_year: payload.birth_year || null,
            death_year: payload.death_year || null,
            is_alive: payload.is_alive !== false,
            father_id: payload.father_id || null,
            phone: payload.phone || null,
            email: payload.email || null,
            location: payload.location || null,
            bio_ar: payload.bio_ar || null,
          })
          .select()
          .single();

        if (!personErr && personData) {
          await supabase.from('family_tree_members').insert({
            tree_id: sub.tree_id,
            person_id: personData.id,
            is_root: false,
          });
        }
      }

      // Mark submission approved
      await supabase
        .from('pending_submissions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', sub.id);

      // Add to history
      await supabase.from('submission_history').insert({
        tree_id: sub.tree_id,
        submission_id: sub.id,
        action: 'approved',
        details: { submission_type: sub.submission_type },
      });

      loadAll();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (sub: PendingSubmission) => {
    setProcessing(sub.id);
    await supabase
      .from('pending_submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', sub.id);

    await supabase.from('submission_history').insert({
      tree_id: sub.tree_id,
      submission_id: sub.id,
      action: 'rejected',
      details: { submission_type: sub.submission_type },
    });

    setProcessing(null);
    loadAll();
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      add_member: 'إضافة عضو',
      edit_member: 'تعديل عضو',
      add_relation: 'إضافة علاقة',
      remove_member: 'حذف عضو',
    };
    return map[type] || type;
  };

  const statusBadge = (status: string) => {
    if (status === 'pending') return <span className="badge badge-orange"><Clock size={11} /> معلق</span>;
    if (status === 'approved') return <span className="badge badge-green"><CheckCircle size={11} /> مقبول</span>;
    if (status === 'rejected') return <span className="badge badge-red"><XCircle size={11} /> مرفوض</span>;
    return null;
  };

  return (
    <AdminLayout title="طلبات المراجعة" subtitle="Pending Submissions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value as any)} id="status-filter">
            <option value="pending">معلقة</option>
            <option value="approved">مقبولة</option>
            <option value="rejected">مرفوضة</option>
            <option value="all">الكل</option>
          </select>
          <select className="form-select" style={{ width: 'auto', minWidth: 180 }} value={treeFilter} onChange={e => setTreeFilter(e.target.value)} id="tree-sub-filter">
            <option value="">كل الأشجار</option>
            {trees.map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="loading-center" style={{ minHeight: 200 }}><div className="spinner" /></div>
        ) : submissions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {filter === 'pending' ? 'لا توجد طلبات معلقة' : 'لا توجد طلبات'}
            </h3>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>نوع الطلب</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الشجرة</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>المقدِّم</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الحالة</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>التاريخ</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub.id}>
                    <td>
                      <span className="badge badge-blue" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                        {typeLabel(sub.submission_type)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontFamily: 'Tajawal, sans-serif' }}>
                      {trees.find(t => t.id === sub.tree_id)?.name_ar || sub.tree_id.slice(0, 8) + '...'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {sub.submitted_by.slice(0, 8)}...
                    </td>
                    <td>{statusBadge(sub.status)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {new Date(sub.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewing(sub)} title="عرض التفاصيل">
                          <Eye size={15} />
                        </button>
                        {sub.status === 'pending' && (
                          <>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#d1fae5', color: '#059669', padding: '5px 10px' }}
                              onClick={() => approve(sub)}
                              disabled={processing === sub.id}
                              title="قبول"
                            >
                              <Check size={14} />
                              <span style={{ fontFamily: 'Tajawal, sans-serif' }}>قبول</span>
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#fee2e2', color: 'var(--color-danger)', padding: '5px 10px' }}
                              onClick={() => reject(sub)}
                              disabled={processing === sub.id}
                              title="رفض"
                            >
                              <X size={14} />
                              <span style={{ fontFamily: 'Tajawal, sans-serif' }}>رفض</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View submission details */}
      {viewing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif' }}>تفاصيل الطلب</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setViewing(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-blue" style={{ fontFamily: 'Tajawal, sans-serif' }}>{typeLabel(viewing.submission_type)}</span>
                  {statusBadge(viewing.status)}
                </div>

                <div className="divider" style={{ margin: '4px 0' }} />

                <h3 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>بيانات الطلب:</h3>
                <div style={{
                  background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)',
                  padding: 16, border: '1px solid var(--color-border)',
                }}>
                  {Object.entries(viewing.payload).map(([key, val]) => (
                    val ? (
                      <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, minWidth: 120 }}>{key}:</span>
                        <span style={{ fontSize: '0.875rem', fontFamily: 'Tajawal, sans-serif' }}>{String(val)}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {viewing.status === 'pending' && (
                <>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => { reject(viewing); setViewing(null); }}>
                    <X size={14} /> <span style={{ fontFamily: 'Tajawal, sans-serif' }}>رفض</span>
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => { approve(viewing); setViewing(null); }}>
                    <Check size={14} /> <span style={{ fontFamily: 'Tajawal, sans-serif' }}>قبول وتطبيق</span>
                  </button>
                </>
              )}
              <button className="btn btn-ghost" onClick={() => setViewing(null)} style={{ fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
