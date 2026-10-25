import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import ImageUploadInput from '@/components/ImageUploadInput';
import { Plus, Pencil, Trash2, X, AlertCircle, Search, User } from 'lucide-react';
import type { Person, FamilyTree } from '@/types';

interface PersonForm {
  full_name_ar: string;
  full_name_en: string;
  gender: 'male' | 'female';
  birth_year: string;
  death_year: string;
  is_alive: boolean;
  father_id: string;
  mother_id: string;
  phone: string;
  email: string;
  location: string;
  bio_ar: string;
  bio_en: string;
  photo_url: string;
  tree_id: string;
}

const emptyForm: PersonForm = {
  full_name_ar: '', full_name_en: '', gender: 'male', birth_year: '', death_year: '',
  is_alive: true, father_id: '', mother_id: '', phone: '', email: '', location: '',
  bio_ar: '', bio_en: '', photo_url: '', tree_id: '',
};

export default function AdminMembers() {
  const [params] = useSearchParams();
  const defaultTreeId = params.get('treeId') || '';

  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [selectedTree, setSelectedTree] = useState(defaultTreeId);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [form, setForm] = useState<PersonForm>({ ...emptyForm, tree_id: defaultTreeId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Person | null>(null);

  useEffect(() => { loadTrees(); }, []);
  useEffect(() => { if (selectedTree) loadPersons(); else loadAllPersons(); }, [selectedTree]);

  const loadTrees = async () => {
    const { data } = await supabase.from('family_trees').select('id, name_ar, name_en').order('name_ar');
    setTrees((data || []) as FamilyTree[]);
  };

  const loadPersons = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('family_tree_members')
      .select('persons(*)')
      .eq('tree_id', selectedTree);
    const list = (data || []).map((m: any) => m.persons).filter(Boolean) as Person[];
    setPersons(list);
    setAllPersons(list);
    setLoading(false);
  };

  const loadAllPersons = async () => {
    setLoading(true);
    const { data } = await supabase.from('persons').select('*').order('full_name_ar');
    setPersons((data || []) as Person[]);
    setAllPersons((data || []) as Person[]);
    setLoading(false);
  };

  const filtered = persons.filter(p =>
    p.full_name_ar.includes(search) ||
    p.full_name_en.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditPerson(null);
    setForm({ ...emptyForm, tree_id: selectedTree });
    setError('');
    setShowModal(true);
  };

  const openEdit = (p: Person) => {
    setEditPerson(p);
    setForm({
      full_name_ar: p.full_name_ar, full_name_en: p.full_name_en,
      gender: p.gender, birth_year: p.birth_year ? String(p.birth_year) : '',
      death_year: p.death_year ? String(p.death_year) : '',
      is_alive: p.is_alive, father_id: p.father_id || '', mother_id: p.mother_id || '',
      phone: p.phone || '', email: p.email || '', location: p.location || '',
      bio_ar: p.bio_ar || '', bio_en: p.bio_en || '', photo_url: p.photo_url || '',
      tree_id: selectedTree,
    });
    setError('');
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name_ar.trim()) { setError('الاسم بالعربي مطلوب'); return; }
    if (!form.tree_id) { setError('يرجى تحديد الشجرة العائلية'); return; }
    setSaving(true);
    setError('');

    const personPayload = {
      full_name_ar: form.full_name_ar.trim(),
      full_name_en: form.full_name_en.trim(),
      gender: form.gender,
      birth_year: form.birth_year ? parseInt(form.birth_year) : null,
      death_year: form.death_year ? parseInt(form.death_year) : null,
      is_alive: form.is_alive,
      father_id: form.father_id || null,
      mother_id: form.mother_id || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      location: form.location.trim() || null,
      bio_ar: form.bio_ar.trim() || null,
      bio_en: form.bio_en.trim() || null,
      photo_url: form.photo_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let personId = editPerson?.id;

    if (editPerson) {
      const { error: err } = await supabase.from('persons').update(personPayload).eq('id', editPerson.id);
      if (err) { setError('خطأ: ' + err.message); setSaving(false); return; }
    } else {
      const { data, error: err } = await supabase.from('persons').insert(personPayload).select().single();
      if (err || !data) { setError('خطأ: ' + (err?.message || 'unknown')); setSaving(false); return; }
      personId = data.id;

      // Add to tree
      const { error: memberErr } = await supabase.from('family_tree_members').insert({
        tree_id: form.tree_id,
        person_id: personId,
        is_root: false,
      });
      if (memberErr && !memberErr.message.includes('unique')) {
        setError('تم إنشاء العضو لكن فشل ربطه بالشجرة: ' + memberErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowModal(false);
    selectedTree ? loadPersons() : loadAllPersons();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await supabase.from('family_tree_members').delete().eq('person_id', deleteConfirm.id);
    await supabase.from('persons').delete().eq('id', deleteConfirm.id);
    setDeleteConfirm(null);
    selectedTree ? loadPersons() : loadAllPersons();
  };

  const malePeople = allPersons.filter(p => p.gender === 'male');
  const femalePeople = allPersons.filter(p => p.gender === 'female');

  return (
    <AdminLayout title="إدارة الأعضاء" subtitle="Members Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Filters + actions */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: 200 }}
              value={selectedTree}
              onChange={e => setSelectedTree(e.target.value)}
              id="tree-filter"
            >
              <option value="">كل الأشجار</option>
              {trees.map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
            </select>

            <div className="search-bar">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="ابحث..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="search-members-admin"
                style={{ paddingTop: 8, paddingBottom: 8 }}
              />
            </div>
          </div>

          <button className="btn btn-primary" onClick={openCreate} id="add-member-btn">
            <Plus size={16} />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>إضافة عضو</span>
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-center" style={{ minHeight: 200 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>لا يوجد أعضاء</h3>
            <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 16, fontFamily: 'Tajawal, sans-serif' }}>
              <Plus size={16} /> إضافة عضو
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الاسم</th>
                  <th>Name (EN)</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الجنس</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الميلاد</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الحالة</th>
                  <th style={{ fontFamily: 'Tajawal, sans-serif' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: p.gender === 'male' ? '#dbeafe' : '#fce7f3',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', flexShrink: 0,
                        }}>
                          {p.photo_url ? <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <User size={18} color={p.gender === 'male' ? 'var(--color-primary)' : '#db2777'} />}
                        </div>
                        <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>{p.full_name_ar}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{p.full_name_en || '—'}</td>
                    <td>
                      <span className={`badge ${p.gender === 'male' ? 'badge-blue' : 'badge-purple'}`}>
                        {p.gender === 'male' ? 'ذكر' : 'أنثى'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{p.birth_year || '—'}</td>
                    <td>
                      <span className={`badge ${p.is_alive ? 'badge-green' : 'badge-gray'}`}>
                        {p.is_alive ? 'حي' : 'متوفى'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)} title="تعديل">
                          <Pencil size={15} />
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteConfirm(p)} style={{ color: 'var(--color-danger)' }} title="حذف">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif' }}>
                {editPerson ? 'تعديل بيانات العضو' : 'إضافة عضو جديد'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {error && (
                  <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />{error}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {/* Tree selector (only for new) */}
                  {!editPerson && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label" htmlFor="member-tree" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                        الشجرة العائلية *
                      </label>
                      <select
                        id="member-tree"
                        className="form-select"
                        name="tree_id"
                        value={form.tree_id}
                        onChange={handleChange}
                        required
                      >
                        <option value="">اختر الشجرة...</option>
                        {trees.map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="m-name-ar" style={{ fontFamily: 'Tajawal, sans-serif' }}>الاسم بالعربية *</label>
                    <input id="m-name-ar" className="form-input" name="full_name_ar" value={form.full_name_ar} onChange={handleChange}
                      placeholder="الاسم الكامل" style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif' }} required />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="m-name-en">Name (English)</label>
                    <input id="m-name-en" className="form-input" name="full_name_en" value={form.full_name_en} onChange={handleChange}
                      placeholder="Full name" dir="ltr" />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="m-gender" style={{ fontFamily: 'Tajawal, sans-serif' }}>الجنس</label>
                    <select id="m-gender" className="form-select" name="gender" value={form.gender} onChange={handleChange}>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="m-alive" style={{ fontFamily: 'Tajawal, sans-serif' }}>الحالة</label>
                    <select id="m-alive" className="form-select" name="is_alive" value={String(form.is_alive)} onChange={e => setForm(f => ({ ...f, is_alive: e.target.value === 'true' }))}>
                      <option value="true">على قيد الحياة</option>
                      <option value="false">متوفى</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="m-birth" style={{ fontFamily: 'Tajawal, sans-serif' }}>سنة الميلاد</label>
                    <input id="m-birth" className="form-input" type="number" name="birth_year" value={form.birth_year} onChange={handleChange} placeholder="1975" min="1800" max={new Date().getFullYear()} />
                  </div>

                  {!form.is_alive && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="m-death" style={{ fontFamily: 'Tajawal, sans-serif' }}>سنة الوفاة</label>
                      <input id="m-death" className="form-input" type="number" name="death_year" value={form.death_year} onChange={handleChange} placeholder="2020" min="1800" max={new Date().getFullYear()} />
                    </div>
                  )}

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="m-father" style={{ fontFamily: 'Tajawal, sans-serif' }}>الوالد</label>
                    <select id="m-father" className="form-select" name="father_id" value={form.father_id} onChange={handleChange}>
                      <option value="">— لا يوجد —</option>
                      {malePeople.filter(p => p.id !== editPerson?.id).map(p => (
                        <option key={p.id} value={p.id}>{p.full_name_ar}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="m-phone" style={{ fontFamily: 'Tajawal, sans-serif' }}>الهاتف</label>
                    <input id="m-phone" className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+968..." dir="ltr" />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="m-location" style={{ fontFamily: 'Tajawal, sans-serif' }}>الموقع</label>
                    <input id="m-location" className="form-input" name="location" value={form.location} onChange={handleChange} placeholder="مسقط، عُمان" style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <ImageUploadInput
                      value={form.photo_url}
                      onChange={(url) => setForm(prev => ({ ...prev, photo_url: url }))}
                      label="الصورة الشخصية"
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="m-bio" style={{ fontFamily: 'Tajawal, sans-serif' }}>نبذة تعريفية</label>
                    <textarea id="m-bio" className="form-textarea" name="bio_ar" value={form.bio_ar} onChange={handleChange}
                      placeholder="معلومات عن هذا العضو..." style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif', minHeight: 80 }} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> حفظ...</> : (editPerson ? 'حفظ التعديلات' : 'إضافة العضو')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-danger)' }}>حذف العضو</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                هل أنت متأكد من حذف "{deleteConfirm.full_name_ar}"؟ هذا الإجراء لا يمكن التراجع عنه.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} style={{ fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button className="btn btn-danger" onClick={handleDelete} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <Trash2 size={15} /> حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
