import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Save, AlertCircle, CheckCircle, Users, User, Plus, Trash2, ListPlus, Sparkles } from 'lucide-react';
import type { Person } from '@/types';

interface Props {
  treeId: string;
  person?: Person | null;
  allPersons: Person[];
  onClose: () => void;
  onSaved: () => void;
  defaultFatherId?: string;
  defaultMotherId?: string;
}

interface ChildRow {
  name: string;
  gender: 'male' | 'female';
}

// Helper to auto-guess gender from Arabic name
const guessGender = (name: string): 'male' | 'female' => {
  const n = name.trim();
  const femaleKeywords = [
    'مريم', 'زينب', 'نور', 'ريم', 'هند', 'شهد', 'سحر', 'أمل', 'هدى', 'منى', 
    'عبير', 'غادة', 'خلود', 'عهود', 'نجلاء', 'شيماء', 'إيمان', 'بثينة', 'عائشة', 
    'خديجة', 'زهراء', 'فاطمة', 'عشه', 'صالحه', 'مهديم', 'حسينه', 'زبيده', 'صفيه', 
    'زمزم', 'محفوظه', 'أسماء', 'سارة', 'لمياء', 'روان', 'رغد', 'دلال', 'سميرة',
    'أروى', 'يسرى', 'بشرى', 'حنان', 'وفاء', 'أمينة', 'جميلة', 'ليلى', 'أميرة'
  ];
  if (femaleKeywords.some(fk => n.includes(fk))) return 'female';
  if (n.endsWith('ة') || n.endsWith('ه') || n.endsWith('ى') || n.endsWith('اء')) return 'female';
  return 'male';
};

// Helper to clean UUID values so pseudo-values like 'direct' or 'undefined' are never sent to Postgres
const sanitizeUuid = (val?: string | null): string => {
  if (!val || val === 'direct' || val === 'undefined' || val === 'null') return '';
  return val.trim();
};

export default function EditMemberModal({ 
  treeId, 
  person, 
  allPersons, 
  onClose, 
  onSaved,
  defaultFatherId,
  defaultMotherId
}: Props) {
  const isEditing = Boolean(person);
  const cleanDefaultFather = sanitizeUuid(defaultFatherId);
  const cleanDefaultMother = sanitizeUuid(defaultMotherId);

  // Tab mode: 'bulk' (multiple children at once) or 'single' (detailed individual form)
  const [mode, setMode] = useState<'bulk' | 'single'>(
    !isEditing && (cleanDefaultFather || cleanDefaultMother) ? 'bulk' : 'single'
  );

  // Single Member Form State
  const [form, setForm] = useState({
    full_name_ar: '',
    full_name_en: '',
    gender: 'male' as 'male' | 'female',
    birth_year: '',
    death_year: '',
    is_alive: true,
    father_id: cleanDefaultFather,
    mother_id: cleanDefaultMother,
    spouse_id: '',
    bio_ar: '',
    phone: '',
    location: '',
  });

  // Bulk Add Children State
  const [bulkFatherId, setBulkFatherId] = useState<string>(cleanDefaultFather);
  const [bulkMotherId, setBulkMotherId] = useState<string>(cleanDefaultMother);
  const [childrenRows, setChildrenRows] = useState<ChildRow[]>([
    { name: '', gender: 'male' },
    { name: '', gender: 'male' },
    { name: '', gender: 'female' },
  ]);
  const [pasteBoxText, setPasteBoxText] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeletePerson = async () => {
    if (!person) return;
    setDeleting(true);
    setError('');

    try {
      // 1. Remove junction link from family_tree_members for this tree
      const { error: ftmErr } = await supabase
        .from('family_tree_members')
        .delete()
        .eq('tree_id', treeId)
        .eq('person_id', person.id);

      if (ftmErr) throw ftmErr;

      // 2. Also remove person record if they belong only to this tree
      const { data: otherTrees } = await supabase
        .from('family_tree_members')
        .select('id')
        .eq('person_id', person.id);

      if (!otherTrees || otherTrees.length === 0) {
        await supabase
          .from('persons')
          .delete()
          .eq('id', person.id);
      }

      setSuccess('تم حذف الفرد من الشجرة بنجاح');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء حذف الفرد');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    if (person) {
      setForm({
        full_name_ar: person.full_name_ar || '',
        full_name_en: person.full_name_en || '',
        gender: person.gender || 'male',
        birth_year: person.birth_year ? String(person.birth_year) : '',
        death_year: person.death_year ? String(person.death_year) : '',
        is_alive: person.is_alive ?? true,
        father_id: sanitizeUuid(person.father_id),
        mother_id: sanitizeUuid(person.mother_id),
        spouse_id: sanitizeUuid(person.spouse_id),
        bio_ar: person.bio_ar || '',
        phone: person.phone || '',
        location: person.location || '',
      });
      setMode('single');
    } else {
      const cleanFather = sanitizeUuid(defaultFatherId);
      const cleanMother = sanitizeUuid(defaultMotherId);
      setForm(prev => ({
        ...prev,
        father_id: cleanFather || sanitizeUuid(prev.father_id),
        mother_id: cleanMother || sanitizeUuid(prev.mother_id),
      }));
      setBulkFatherId(cleanFather);
      setBulkMotherId(cleanMother);
    }
  }, [person, defaultFatherId, defaultMotherId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(prev => ({ ...prev, [name]: checked }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Bulk Add helpers
  const handleChildNameChange = (index: number, newName: string) => {
    setChildrenRows(prev => {
      const updated = [...prev];
      const guessed = guessGender(newName);
      updated[index] = {
        name: newName,
        // Only auto-switch to female if it strongly matches female pattern, otherwise keep current
        gender: guessed === 'female' ? 'female' : updated[index].gender,
      };
      return updated;
    });
  };

  const handleChildGenderChange = (index: number, gender: 'male' | 'female') => {
    setChildrenRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], gender };
      return updated;
    });
  };

  const handleAddChildRow = () => {
    setChildrenRows(prev => [...prev, { name: '', gender: 'male' }]);
  };

  const handleRemoveChildRow = (index: number) => {
    setChildrenRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyPastedNames = () => {
    if (!pasteBoxText.trim()) return;
    const lines = pasteBoxText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return;

    const newRows: ChildRow[] = lines.map(name => ({
      name,
      gender: guessGender(name),
    }));

    setChildrenRows(prev => {
      // Filter out empty rows from current list, then append parsed names
      const nonEmpty = prev.filter(r => r.name.trim().length > 0);
      return [...nonEmpty, ...newRows];
    });

    setPasteBoxText('');
    setShowPasteBox(false);
  };

  // Single Save
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name_ar.trim()) {
      setError('الاسم بالعربية مطلوب');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload: any = {
        full_name_ar: form.full_name_ar.trim(),
        full_name_en: form.full_name_en.trim(),
        gender: form.gender,
        birth_year: form.birth_year ? parseInt(form.birth_year, 10) : null,
        death_year: form.death_year ? parseInt(form.death_year, 10) : null,
        is_alive: form.is_alive,
        father_id: sanitizeUuid(form.father_id) || null,
        mother_id: sanitizeUuid(form.mother_id) || null,
        spouse_id: sanitizeUuid(form.spouse_id) || null,
        bio_ar: form.bio_ar.trim() || null,
        phone: form.phone.trim() || null,
        location: form.location.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEditing && person) {
        const { error: err } = await supabase
          .from('persons')
          .update(payload)
          .eq('id', person.id);
        if (err) throw err;
      } else {
        const { data: newPerson, error: insertErr } = await supabase
          .from('persons')
          .insert(payload)
          .select()
          .single();
        if (insertErr) throw insertErr;

        // Link to tree
        const { error: linkErr } = await supabase
          .from('family_tree_members')
          .insert({
            tree_id: treeId,
            person_id: newPerson.id,
            is_root: false,
          });
        if (linkErr) throw linkErr;
      }

      setSuccess('تم الحفظ بنجاح');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  // Bulk Submit
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = childrenRows.filter(r => r.name.trim().length > 0);

    if (validRows.length === 0) {
      setError('يرجى إدخال اسم واحد على الأقل للأبناء');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const cleanBulkFather = sanitizeUuid(bulkFatherId) || null;
      const cleanBulkMother = sanitizeUuid(bulkMotherId) || null;

      const payloadList = validRows.map(child => ({
        full_name_ar: child.name.trim(),
        gender: child.gender,
        father_id: cleanBulkFather,
        mother_id: cleanBulkMother,
        is_alive: true,
        updated_at: new Date().toISOString(),
      }));

      // 1. Insert multiple persons
      const { data: insertedPersons, error: insertErr } = await supabase
        .from('persons')
        .insert(payloadList)
        .select('id');

      if (insertErr) throw insertErr;

      // 2. Link all new persons to the tree
      const memberLinks = (insertedPersons || []).map(p => ({
        tree_id: treeId,
        person_id: p.id,
        is_root: false,
      }));

      const { error: linkErr } = await supabase
        .from('family_tree_members')
        .insert(memberLinks);

      if (linkErr) throw linkErr;

      setSuccess(`تمت إضافة ${validRows.length} من الأبناء بنجاح!`);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة الأبناء');
    } finally {
      setSaving(false);
    }
  };

  // Filter possible fathers & mothers
  const malePersons = allPersons.filter(p => p.gender === 'male' && (!person || p.id !== person.id));
  const femalePersons = allPersons.filter(p => p.gender === 'female' && (!person || p.id !== person.id));
  const potentialSpouses = allPersons.filter(p => !person || p.id !== person.id);

  // Selected parent names for bulk display
  const selectedFatherName = malePersons.find(p => p.id === bulkFatherId)?.full_name_ar;
  const selectedMotherName = femalePersons.find(p => p.id === bulkMotherId)?.full_name_ar;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-slideUp" style={{ maxWidth: mode === 'bulk' ? 680 : 640 }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a' }}>
              {isEditing ? `تعديل بيانات: ${person?.full_name_ar}` : 'إضافة إلى شجرة العائلة'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
              {isEditing ? 'تعديل البيانات الشخصية والقرابة' : 'اختر إضافة فرد واحد أو إضافة سريعة لعدة أبناء دفعة واحدة'}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        {/* Mode Switcher Tabs (Only when adding new members) */}
        {!isEditing && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1.5px solid #e2e8f0',
            background: '#f8fafc',
          }}>
            <button
              type="button"
              onClick={() => { setMode('bulk'); setError(''); }}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: mode === 'bulk' ? '#ffffff' : 'transparent',
                color: mode === 'bulk' ? '#1d4ed8' : '#64748b',
                fontWeight: 800,
                fontFamily: 'Tajawal, sans-serif',
                fontSize: '0.92rem',
                cursor: 'pointer',
                borderBottom: mode === 'bulk' ? '3px solid #1d4ed8' : '3px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={17} color={mode === 'bulk' ? '#1d4ed8' : '#64748b'} />
              <span>إضافة عدة أبناء دفعة واحدة (سريع)</span>
            </button>

            <button
              type="button"
              onClick={() => { setMode('single'); setError(''); }}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: mode === 'single' ? '#ffffff' : 'transparent',
                color: mode === 'single' ? '#1d4ed8' : '#64748b',
                fontWeight: 800,
                fontFamily: 'Tajawal, sans-serif',
                fontSize: '0.92rem',
                cursor: 'pointer',
                borderBottom: mode === 'single' ? '3px solid #1d4ed8' : '3px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <User size={17} color={mode === 'single' ? '#1d4ed8' : '#64748b'} />
              <span>إضافة فرد واحد بالتفصيل</span>
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODE 1: BULK ADD CHILDREN (إضافة متعددة سريعة للأبناء) */}
        {/* ======================================================== */}
        {mode === 'bulk' && !isEditing ? (
          <form onSubmit={handleBulkSubmit}>
            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {error && (
                <div className="alert alert-danger" style={{ marginBottom: 14 }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="alert alert-success" style={{ marginBottom: 14 }}>
                  <CheckCircle size={18} />
                  <span>{success}</span>
                </div>
              )}

              {/* Parents Selection Bar */}
              <div style={{
                background: '#eff6ff',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
                border: '1.5px solid #bfdbfe',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: '#1e40af' }}>
                    الأب (الوالد):
                  </label>
                  <select
                    className="form-control"
                    value={bulkFatherId}
                    onChange={e => setBulkFatherId(e.target.value)}
                    style={{ background: '#ffffff', borderColor: '#93c5fd' }}
                  >
                    <option value="">-- بدون أب محدد --</option>
                    {malePersons.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name_ar}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: '#db2777' }}>
                    الأم (الوالدة):
                  </label>
                  <select
                    className="form-control"
                    value={bulkMotherId}
                    onChange={e => setBulkMotherId(e.target.value)}
                    style={{ background: '#ffffff', borderColor: '#fbcfe8' }}
                  >
                    <option value="">-- بدون أم محددة --</option>
                    {femalePersons.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Parent Banner confirmation */}
              {(selectedFatherName || selectedMotherName) && (
                <div style={{
                  fontSize: '0.82rem',
                  color: '#1e3a8a',
                  background: '#f0f9ff',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Sparkles size={15} color="#0284c7" />
                  <span>
                    سيتم إضافة الأبناء تالياً تحت: <b>{selectedFatherName || '—'}</b> {selectedMotherName ? `و <b>${selectedMotherName}</b>` : ''}
                  </span>
                </div>
              )}

              {/* Paste List Toggle Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                  قائمة أسماء الأبناء المراد إضافتهم ({childrenRows.filter(r => r.name.trim()).length}):
                </span>
                <button
                  type="button"
                  onClick={() => setShowPasteBox(!showPasteBox)}
                  className="btn btn-ghost btn-sm"
                  style={{ borderRadius: 'var(--radius-full)', color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff', gap: 6 }}
                >
                  <ListPlus size={15} />
                  {showPasteBox ? 'إخفاء مربع اللصق' : '📋 لصق قائمة أسماء دفعة واحدة'}
                </button>
              </div>

              {/* Paste Box Area (if toggled) */}
              {showPasteBox && (
                <div style={{
                  background: '#f8fafc',
                  border: '1.5px dashed #93c5fd',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>
                    الصق هنا أسماء الأبناء (كل اسم في سطر)، وسيتم التعرف على الجنس تلقائياً:
                  </div>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={pasteBoxText}
                    onChange={e => setPasteBoxText(e.target.value)}
                    placeholder={"مثال:\nمحمد\nسالم\nفاطمة\nمريم\nعبدالله"}
                    style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif', fontSize: '0.9rem' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowPasteBox(false)}
                      className="btn btn-ghost btn-sm"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyPastedNames}
                      className="btn btn-primary btn-sm"
                      disabled={!pasteBoxText.trim()}
                    >
                      تحويل القائمة وإدراج الأسماء
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic Children Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {childrenRows.map((child, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', minWidth: 22, textAlign: 'center' }}>
                      {idx + 1}
                    </span>

                    {/* Child Name input */}
                    <input
                      type="text"
                      className="form-control"
                      value={child.name}
                      onChange={e => handleChildNameChange(idx, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddChildRow();
                        }
                      }}
                      placeholder="اسم الابن أو الابنة الكامل..."
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.92rem' }}
                      required={idx === 0}
                    />

                    {/* Gender Toggle Buttons: Blue for Male, Pink for Female */}
                    <div style={{
                      display: 'flex',
                      borderRadius: 'var(--radius-full)',
                      padding: 2,
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                    }}>
                      <button
                        type="button"
                        onClick={() => handleChildGenderChange(idx, 'male')}
                        style={{
                          border: 'none',
                          borderRadius: 'var(--radius-full)',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontFamily: 'Tajawal, sans-serif',
                          fontWeight: 800,
                          cursor: 'pointer',
                          background: child.gender === 'male' ? '#1d4ed8' : 'transparent',
                          color: child.gender === 'male' ? '#ffffff' : '#64748b',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        ♂ ذكر
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChildGenderChange(idx, 'female')}
                        style={{
                          border: 'none',
                          borderRadius: 'var(--radius-full)',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontFamily: 'Tajawal, sans-serif',
                          fontWeight: 800,
                          cursor: 'pointer',
                          background: child.gender === 'female' ? '#db2777' : 'transparent',
                          color: child.gender === 'female' ? '#ffffff' : '#64748b',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        ♀ أنثى
                      </button>
                    </div>

                    {/* Delete row */}
                    {childrenRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChildRow(idx)}
                        className="btn-icon"
                        style={{ width: 28, height: 28, color: '#ef4444', padding: 0 }}
                        title="حذف هذا السطر"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Row Button */}
              <button
                type="button"
                onClick={handleAddChildRow}
                className="btn btn-secondary btn-sm"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  borderStyle: 'dashed',
                  gap: 6,
                  fontWeight: 700,
                }}
              >
                <Plus size={16} /> إضافة ابن / ابنة أخرى للقائمة
              </button>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ background: '#f8fafc' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                إلغاء
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || childrenRows.filter(r => r.name.trim()).length === 0}
                style={{ gap: 8, padding: '10px 24px', fontWeight: 800 }}
              >
                <Save size={16} />
                {saving 
                  ? 'جاري حفظ الأبناء...' 
                  : `حفظ جميع الأبناء (${childrenRows.filter(r => r.name.trim()).length}) دفعة واحدة`}
              </button>
            </div>
          </form>
        ) : (
          /* ======================================================== */
          /* MODE 2: SINGLE MEMBER FORM (النموذج الفردي المفصل) */
          /* ======================================================== */
          <form onSubmit={handleSingleSubmit}>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {error && (
                <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  <CheckCircle size={18} />
                  <span>{success}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label required">الاسم الكامل (بالعربية)</label>
                  <input
                    type="text"
                    name="full_name_ar"
                    className="form-control"
                    value={form.full_name_ar}
                    onChange={handleChange}
                    placeholder="مثال: أحمد بن علي الزدجالي"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">الاسم بالإنجليزية (اختياري)</label>
                  <input
                    type="text"
                    name="full_name_en"
                    className="form-control"
                    value={form.full_name_en}
                    onChange={handleChange}
                    placeholder="Ahmed Ali"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">الجنس</label>
                  <select
                    name="gender"
                    className="form-control"
                    value={form.gender}
                    onChange={handleChange}
                  >
                    <option value="male">ذكر (♂)</option>
                    <option value="female">أنثى (♀)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">الوالد (الأب)</label>
                  <select
                    name="father_id"
                    className="form-control"
                    value={form.father_id}
                    onChange={handleChange}
                  >
                    <option value="">-- بدون والد محدد --</option>
                    {malePersons.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name_ar}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">الوالدة (الأم)</label>
                  <select
                    name="mother_id"
                    className="form-control"
                    value={form.mother_id}
                    onChange={handleChange}
                  >
                    <option value="">-- بدون والدة محددة --</option>
                    {femalePersons.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name_ar}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">الزوج / الزوجة</label>
                  <select
                    name="spouse_id"
                    className="form-control"
                    value={form.spouse_id}
                    onChange={handleChange}
                  >
                    <option value="">-- بدون زوج / زوجة --</option>
                    {potentialSpouses.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name_ar} ({p.gender === 'male' ? 'ذكر' : 'أنثى'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">سنة الميلاد</label>
                  <input
                    type="number"
                    name="birth_year"
                    className="form-control"
                    value={form.birth_year}
                    onChange={handleChange}
                    placeholder="مثال: 1970"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">سنة الوفاة (إن وجد)</label>
                  <input
                    type="number"
                    name="death_year"
                    className="form-control"
                    value={form.death_year}
                    onChange={handleChange}
                    placeholder="مثال: 2020"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>
                    <input
                      type="checkbox"
                      name="is_alive"
                      checked={form.is_alive}
                      onChange={handleChange}
                    />
                    <span>على قيد الحياة</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">رقم الهاتف</label>
                  <input
                    type="text"
                    name="phone"
                    className="form-control"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+968 ..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">مكان الإقامة / المدينة</label>
                  <input
                    type="text"
                    name="location"
                    className="form-control"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="مسقط، عمان"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">نبذة أو ملاحظات</label>
                  <textarea
                    name="bio_ar"
                    className="form-control"
                    rows={2}
                    value={form.bio_ar}
                    onChange={handleChange}
                    placeholder="نبذة عن العضو..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: isEditing ? 'space-between' : 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {isEditing && (
                <div>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setConfirmDelete(true)}
                      disabled={saving || deleting}
                      style={{
                        color: 'var(--color-danger)',
                        borderColor: '#fca5a5',
                        background: '#fef2f2',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.85rem',
                        fontFamily: 'Tajawal, sans-serif',
                      }}
                    >
                      <Trash2 size={15} />
                      <span>حذف هذا الفرد من الشجرة</span>
                    </button>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fef2f2', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid #fca5a5' }}>
                      <span style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 700, fontFamily: 'Tajawal, sans-serif' }}>
                        هل أنت متأكد من الحذف؟
                      </span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={handleDeletePerson}
                        disabled={deleting}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.8rem',
                          fontFamily: 'Tajawal, sans-serif',
                          padding: '4px 10px',
                        }}
                      >
                        <Trash2 size={13} />
                        <span>{deleting ? 'جاري الحذف...' : 'نعم، حذف نهائياً'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                        style={{ fontSize: '0.8rem', fontFamily: 'Tajawal, sans-serif', padding: '4px 8px' }}
                      >
                        تراجع
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving || deleting}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || deleting}>
                  <Save size={16} />
                  {saving ? 'جاري الحفظ...' : isEditing ? 'حفظ التعديلات' : 'إضافة الفرد'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
