import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Save, AlertCircle, CheckCircle } from 'lucide-react';
import type { FamilyTree } from '@/types';
import ImageUploadInput from '@/components/ImageUploadInput';

interface Props {
  tree: FamilyTree;
  onClose: () => void;
  onSaved: (updated: FamilyTree) => void;
}

export default function EditTreeModal({ tree, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name_ar: tree.name_ar || '',
    name_en: tree.name_en || '',
    description_ar: tree.description_ar || '',
    description_en: tree.description_en || '',
    cover_image_url: tree.cover_image_url || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ar.trim()) {
      setError('اسم الشجرة بالعربية مطلوب');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim(),
        description_ar: form.description_ar.trim() || null,
        description_en: form.description_en.trim() || null,
        cover_image_url: form.cover_image_url.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error: err } = await supabase
        .from('family_trees')
        .update(payload)
        .eq('id', tree.id)
        .select()
        .single();

      if (err) throw err;

      setSuccess('تم تحديث بيانات الشجرة بنجاح');
      setTimeout(() => {
        onSaved(data as FamilyTree);
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التحديث');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-slideUp" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
            تعديل بيانات الشجرة
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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

            <div className="form-group">
              <label className="form-label required">اسم الشجرة (بالعربية)</label>
              <input
                type="text"
                name="name_ar"
                className="form-control"
                value={form.name_ar}
                onChange={handleChange}
                placeholder="مثال: عائلة الشيخ علي عيسى الزدجالي"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">الاسم بالإنجليزية (اختياري)</label>
              <input
                type="text"
                name="name_en"
                className="form-control"
                value={form.name_en}
                onChange={handleChange}
                placeholder="Ali Essa Al-Zadjali Family"
              />
            </div>

            <div className="form-group">
              <label className="form-label">نبذة عن العائلة وتاريخها (بالعربية)</label>
              <textarea
                name="description_ar"
                className="form-control"
                rows={3}
                value={form.description_ar}
                onChange={handleChange}
                placeholder="شجرة العائلة الكريمة..."
              />
            </div>

            <ImageUploadInput
              value={form.cover_image_url}
              onChange={(url) => setForm(prev => ({ ...prev, cover_image_url: url }))}
              label="صورة غلاف الشجرة"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              إلغاء
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
