import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import ImageUploadInput from '@/components/ImageUploadInput';
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  Globe,
  Lock,
  Clock,
  Check,
} from 'lucide-react';
import type { FamilyTree } from '@/types';

interface TreeForm {
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  cover_image_url: string;
  status: 'active' | 'archived';
}

const emptyForm: TreeForm = {
  name_ar: '', name_en: '', description_ar: '', description_en: '', cover_image_url: '', status: 'active',
};

export default function AdminTrees() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [loading, setLoading] = useState(true);
  const initialTab = (searchParams.get('tab') as any) || 'all';
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'published' | 'private'>(
    ['all', 'pending', 'published', 'private'].includes(initialTab) ? initialTab : 'all'
  );
  const [showModal, setShowModal] = useState(false);
  const [editTree, setEditTree] = useState<FamilyTree | null>(null);
  const [form, setForm] = useState<TreeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<FamilyTree | null>(null);

  // Reject publish request state
  const [rejectingPublishTree, setRejectingPublishTree] = useState<FamilyTree | null>(null);
  const [rejectPublishReason, setRejectPublishReason] = useState('');

  useEffect(() => { loadTrees(); }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['all', 'pending', 'published', 'private'].includes(tab)) {
      setStatusFilter(tab as any);
    }
  }, [searchParams]);

  const loadTrees = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('family_trees')
      .select('*, family_tree_members(count)')
      .order('created_at', { ascending: false });

    setTrees((data || []).map((t: any) => ({
      ...t,
      member_count: t.family_tree_members?.[0]?.count ?? 0,
    })));
    setLoading(false);
  };

  const pendingPublishCount = useMemo(() => {
    return trees.filter(t => t.publish_status === 'pending_approval').length;
  }, [trees]);

  const filteredTrees = useMemo(() => {
    if (statusFilter === 'pending') {
      return trees.filter(t => t.publish_status === 'pending_approval');
    }
    if (statusFilter === 'published') {
      return trees.filter(t => t.publish_status === 'published');
    }
    if (statusFilter === 'private') {
      return trees.filter(t => t.publish_status === 'draft' || t.publish_status === 'rejected');
    }
    return trees;
  }, [trees, statusFilter]);

  const handleApprovePublish = async (tree: FamilyTree) => {
    try {
      const { error: updErr } = await supabase
        .from('family_trees')
        .update({
          publish_status: 'published',
          visibility: 'public',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tree.id);

      if (updErr) throw updErr;

      setSuccess(`تم اعتماد ونشر شجرة (${tree.name_ar}) في المنصة العامة بنجاح!`);
      loadTrees();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError('خطأ أثناء اعتماد النشر: ' + e.message);
    }
  };

  const handleRejectPublishPrompt = (tree: FamilyTree) => {
    setRejectingPublishTree(tree);
    setRejectPublishReason('');
  };

  const handleConfirmRejectPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPublishTree) return;
    try {
      const { error: updErr } = await supabase
        .from('family_trees')
        .update({
          publish_status: 'rejected',
          publish_rejection_reason: rejectPublishReason.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rejectingPublishTree.id);

      if (updErr) throw updErr;

      setSuccess(`تم رفض طلب نشر شجرة (${rejectingPublishTree.name_ar})`);
      setRejectingPublishTree(null);
      loadTrees();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError('خطأ أثناء رفض النشر: ' + e.message);
    }
  };

  const openCreate = () => { setEditTree(null); setForm(emptyForm); setError(''); setShowModal(true); };
  const openEdit = (tree: FamilyTree) => {
    setEditTree(tree);
    setForm({
      name_ar: tree.name_ar, name_en: tree.name_en,
      description_ar: tree.description_ar || '',
      description_en: tree.description_en || '',
      cover_image_url: tree.cover_image_url || '',
      status: tree.status,
    });
    setError('');
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ar.trim()) { setError('اسم الشجرة بالعربية مطلوب'); return; }
    setSaving(true);
    setError('');

    const payload = {
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim(),
      description_ar: form.description_ar.trim() || null,
      description_en: form.description_en.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      status: form.status,
      updated_at: new Date().toISOString(),
    };

    let err;
    if (editTree) {
      ({ error: err } = await supabase.from('family_trees').update(payload).eq('id', editTree.id));
    } else {
      ({ error: err } = await supabase.from('family_trees').insert(payload));
    }

    setSaving(false);
    if (err) { setError('حدث خطأ: ' + err.message); }
    else {
      setSuccess(editTree ? 'تم تحديث الشجرة بنجاح' : 'تم إنشاء الشجرة بنجاح');
      setShowModal(false);
      loadTrees();
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await supabase.from('family_trees').delete().eq('id', deleteConfirm.id);
    setDeleteConfirm(null);
    loadTrees();
  };

  const handleArchive = async (tree: FamilyTree) => {
    const newStatus = tree.status === 'active' ? 'archived' : 'active';
    await supabase.from('family_trees').update({ status: newStatus }).eq('id', tree.id);
    loadTrees();
  };

  return (
    <AdminLayout title="الأشجار العائلية" subtitle="Family Trees Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {success && (
          <div className="alert alert-success" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <CheckCircle size={16} />{success}
          </div>
        )}

        {/* Filter Tabs & Header actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--color-surface-2)', padding: 4, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setStatusFilter('all'); setSearchParams({}); }}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              جميع الأشجار ({trees.length})
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setStatusFilter('pending'); setSearchParams({ tab: 'pending' }); }}
              style={{
                fontFamily: 'Tajawal, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: statusFilter === 'pending' ? undefined : pendingPublishCount > 0 ? '#fef3c7' : undefined,
                color: statusFilter === 'pending' ? undefined : pendingPublishCount > 0 ? '#b45309' : undefined,
                border: pendingPublishCount > 0 && statusFilter !== 'pending' ? '1px solid #fde68a' : undefined,
                fontWeight: pendingPublishCount > 0 ? 800 : undefined,
              }}
            >
              <Clock size={14} />
              <span>طلبات النشر ({pendingPublishCount})</span>
              {pendingPublishCount > 0 && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
              )}
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'published' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setStatusFilter('published'); setSearchParams({ tab: 'published' }); }}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              المنشورة عامة
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'private' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setStatusFilter('private'); setSearchParams({ tab: 'private' }); }}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              الخاصة (مسودات الأعضاء)
            </button>
          </div>

          <button className="btn btn-primary" onClick={openCreate} id="create-tree-btn">
            <Plus size={16} />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>إنشاء شجرة جديدة</span>
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-center" style={{ minHeight: 200 }}><div className="spinner" /></div>
        ) : filteredTrees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌳</div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>لا توجد أشجار في هذا القسم</h3>
            <p style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-text-muted)' }}>
              {statusFilter === 'pending' ? 'لا توجد طلبات نشر أشجار معلقة بانتظار الاعتماد حالياً' : 'يمكنك إنشاء شجرة جديدة من الزر أعلاه'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>اسم الشجرة</th>
                  <th>Family Name</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الأعضاء</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>حالة الشجرة</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>حالة النشر والظهور</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>تاريخ الإنشاء</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrees.map(tree => {
                  const isPendingPub = tree.publish_status === 'pending_approval';
                  const isPub = tree.publish_status === 'published';

                  return (
                    <tr key={tree.id}>
                      <td style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 600, direction: 'rtl' }}>
                        <div>{tree.name_ar}</div>
                        {tree.publish_request_note && isPendingPub && (
                          <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 2 }}>
                            ملاحظة العضو: {tree.publish_request_note}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{tree.name_en || '—'}</td>
                      <td>
                        <span className="badge badge-blue">{tree.member_count ?? 0} عضو</span>
                      </td>
                      <td>
                        <span className={`badge ${tree.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                          {tree.status === 'active' ? 'نشط' : 'مؤرشف'}
                        </span>
                      </td>
                      <td>
                        {isPub ? (
                          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Globe size={12} /> منشورة عامة
                          </span>
                        ) : isPendingPub ? (
                          <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} /> طلب نشر معلق
                          </span>
                        ) : tree.publish_status === 'rejected' ? (
                          <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <X size={12} /> مرفوض النشر
                          </span>
                        ) : (
                          <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Lock size={12} /> خاصة بالمنشئ
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        {new Date(tree.created_at).toLocaleDateString('ar-SA')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {isPendingPub && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleApprovePublish(tree)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.78rem', background: '#059669' }}
                                title="اعتماد ونشر الشجرة في المنصة العامة"
                              >
                                <Check size={13} />
                                <span>اعتماد النشر</span>
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleRejectPublishPrompt(tree)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.78rem', color: 'var(--color-danger)' }}
                                title="رفض طلب النشر"
                              >
                                <X size={13} />
                                <span>رفض</span>
                              </button>
                            </>
                          )}
                          <a href={`/trees/${tree.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm btn-icon" title="عرض الشجرة">
                            <Eye size={15} />
                          </a>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(tree)} title="تعديل">
                            <Pencil size={15} />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleArchive(tree)} title={tree.status === 'active' ? 'أرشفة' : 'تفعيل'}>
                            <Archive size={15} />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteConfirm(tree)} title="حذف" style={{ color: 'var(--color-danger)' }}>
                            <Trash2 size={15} />
                          </button>
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal animate-slideUp">
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif' }}>
                {editTree ? 'تعديل الشجرة العائلية' : 'إنشاء شجرة جديدة'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    <AlertCircle size={16} />{error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="tree-name-ar" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    اسم العائلة بالعربية *
                  </label>
                  <input
                    id="tree-name-ar"
                    className="form-input"
                    name="name_ar"
                    value={form.name_ar}
                    onChange={handleChange}
                    placeholder="مثال: عائلة الزدجالي"
                    style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tree-name-en">Family Name (English)</label>
                  <input
                    id="tree-name-en"
                    className="form-input"
                    name="name_en"
                    value={form.name_en}
                    onChange={handleChange}
                    placeholder="e.g., Al Zadjali Family"
                    dir="ltr"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tree-desc-ar" style={{ fontFamily: 'Tajawal, sans-serif' }}>وصف العائلة (اختياري)</label>
                  <textarea
                    id="tree-desc-ar"
                    className="form-textarea"
                    name="description_ar"
                    value={form.description_ar}
                    onChange={handleChange}
                    placeholder="نبذة مختصرة عن هذه العائلة..."
                    style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tree-desc-en">Description (English, optional)</label>
                  <textarea
                    id="tree-desc-en"
                    className="form-textarea"
                    name="description_en"
                    value={form.description_en}
                    onChange={handleChange}
                    placeholder="A brief description of this family..."
                    dir="ltr"
                    style={{ minHeight: 80 }}
                  />
                </div>

                <ImageUploadInput
                  value={form.cover_image_url}
                  onChange={(url) => setForm(prev => ({ ...prev, cover_image_url: url }))}
                  label="صورة غلاف الشجرة"
                />

                <div className="form-group">
                  <label className="form-label" htmlFor="tree-status" style={{ fontFamily: 'Tajawal, sans-serif' }}>الحالة</label>
                  <select id="tree-status" className="form-select" name="status" value={form.status} onChange={handleChange}>
                    <option value="active">نشط</option>
                    <option value="archived">مؤرشف</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> جاري الحفظ...</> : (editTree ? 'حفظ التعديلات' : 'إنشاء الشجرة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)' }}>تأكيد الحذف</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                سيتم حذف شجرة "{deleteConfirm.name_ar}" وجميع بياناتها نهائياً. هذا الإجراء لا يمكن التراجع عنه!
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} style={{ fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button className="btn btn-danger" onClick={handleDelete} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <Trash2 size={15} /> حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Publish Request Modal */}
      {rejectingPublishTree && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRejectingPublishTree(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)' }}>
                رفض طلب نشر الشجرة
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setRejectingPublishTree(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleConfirmRejectPublish}>
              <div className="modal-body">
                <p style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 16px' }}>
                  هل أنت متأكد من رفض طلب نشر شجرة <strong>({rejectingPublishTree.name_ar})</strong> في الصفحة العامة؟ ستظل الشجرة خاصة بالعضو المنشئ فقط.
                </p>

                <div className="form-group">
                  <label className="form-label" htmlFor="reject-pub-reason" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    سبب الرفض (يظهر للعضو المنشئ):
                  </label>
                  <textarea
                    id="reject-pub-reason"
                    className="form-textarea"
                    rows={3}
                    value={rejectPublishReason}
                    onChange={e => setRejectPublishReason(e.target.value)}
                    placeholder="مثال: يرجى استكمال بيانات الجيل الأول قبل النشر العام..."
                    style={{ fontFamily: 'Tajawal, sans-serif' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setRejectingPublishTree(null)} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-danger" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  تأكيد الرفض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
