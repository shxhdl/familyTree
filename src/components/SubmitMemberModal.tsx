import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, AlertCircle, CheckCircle } from 'lucide-react';
import type { Person } from '@/types';

interface Props {
  treeId: string;
  persons: Person[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function SubmitMemberModal({ treeId, persons, onClose, onSubmitted }: Props) {
  const { authUser } = useAuth();
  const [form, setForm] = useState({
    full_name_ar: '',
    full_name_en: '',
    gender: 'male',
    birth_year: '',
    death_year: '',
    is_alive: 'true',
    father_id: '',
    phone: '',
    email: '',
    location: '',
    bio_ar: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name_ar.trim()) { setError('الاسم بالعربي مطلوب'); return; }

    setLoading(true);
    setError('');

    const payload = {
      full_name_ar: form.full_name_ar.trim(),
      full_name_en: form.full_name_en.trim(),
      gender: form.gender,
      birth_year: form.birth_year ? parseInt(form.birth_year) : null,
      death_year: form.death_year ? parseInt(form.death_year) : null,
      is_alive: form.is_alive === 'true',
      father_id: form.father_id || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      location: form.location.trim() || null,
      bio_ar: form.bio_ar.trim() || null,
    };

    const { error: err } = await supabase
      .from('pending_submissions')
      .insert({
        tree_id: treeId,
        submitted_by: authUser!.id,
        submission_type: 'add_member',
        payload,
        status: 'pending',
      });

    setLoading(false);
    if (err) {
      setError('حدث خطأ أثناء الإرسال، يرجى المحاولة مجدداً');
    } else {
      setDone(true);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-slideUp" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2 style={{ fontFamily: 'Tajawal, sans-serif' }}>اقتراح إضافة عضو جديد</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        {done ? (
          <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', padding: '40px' }}>
            <CheckCircle size={56} color="var(--color-success)" />
            <h3 style={{ fontFamily: 'Tajawal, sans-serif', marginTop: 16, fontSize: '1.2rem' }}>تم الإرسال بنجاح!</h3>
            <p style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-text-muted)', marginTop: 8 }}>
              سيراجع المدير طلبك وسيتم إضافة العضو عند الموافقة.
            </p>
            <button className="btn btn-primary" onClick={onSubmitted} style={{ marginTop: 24 }}>
              حسناً
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />{error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="sub-name-ar" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                    الاسم الكامل بالعربية *
                  </label>
                  <input
                    id="sub-name-ar"
                    className="form-input"
                    name="full_name_ar"
                    value={form.full_name_ar}
                    onChange={handleChange}
                    placeholder="الاسم الكامل"
                    style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="sub-name-en">Full Name (English)</label>
                  <input
                    id="sub-name-en"
                    className="form-input"
                    name="full_name_en"
                    value={form.full_name_en}
                    onChange={handleChange}
                    placeholder="Full name in English"
                    dir="ltr"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="sub-gender" style={{ fontFamily: 'Tajawal, sans-serif' }}>الجنس</label>
                  <select id="sub-gender" className="form-select" name="gender" value={form.gender} onChange={handleChange}>
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="sub-alive" style={{ fontFamily: 'Tajawal, sans-serif' }}>الحالة</label>
                  <select id="sub-alive" className="form-select" name="is_alive" value={form.is_alive} onChange={handleChange}>
                    <option value="true">على قيد الحياة</option>
                    <option value="false">متوفى</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="sub-birth" style={{ fontFamily: 'Tajawal, sans-serif' }}>سنة الميلاد</label>
                  <input
                    id="sub-birth"
                    className="form-input"
                    type="number"
                    name="birth_year"
                    value={form.birth_year}
                    onChange={handleChange}
                    placeholder="مثال: 1975"
                    min="1800"
                    max={new Date().getFullYear()}
                  />
                </div>

                {form.is_alive === 'false' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="sub-death" style={{ fontFamily: 'Tajawal, sans-serif' }}>سنة الوفاة</label>
                    <input
                      id="sub-death"
                      className="form-input"
                      type="number"
                      name="death_year"
                      value={form.death_year}
                      onChange={handleChange}
                      placeholder="مثال: 2020"
                      min="1800"
                      max={new Date().getFullYear()}
                    />
                  </div>
                )}

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="sub-father" style={{ fontFamily: 'Tajawal, sans-serif' }}>الوالد (اختياري)</label>
                  <select id="sub-father" className="form-select" name="father_id" value={form.father_id} onChange={handleChange}>
                    <option value="">— لا يوجد / غير محدد —</option>
                    {persons.filter(p => p.gender === 'male').map(p => (
                      <option key={p.id} value={p.id}>{p.full_name_ar}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="sub-phone" style={{ fontFamily: 'Tajawal, sans-serif' }}>الهاتف</label>
                  <input id="sub-phone" className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+968 9000 0000" dir="ltr" />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="sub-location" style={{ fontFamily: 'Tajawal, sans-serif' }}>الموقع</label>
                  <input id="sub-location" className="form-input" name="location" value={form.location} onChange={handleChange} placeholder="مسقط، عُمان" style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif' }} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="sub-bio" style={{ fontFamily: 'Tajawal, sans-serif' }}>نبذة تعريفية (اختياري)</label>
                  <textarea
                    id="sub-bio"
                    className="form-textarea"
                    name="bio_ar"
                    value={form.bio_ar}
                    onChange={handleChange}
                    placeholder="معلومات إضافية عن هذا العضو..."
                    style={{ direction: 'rtl', fontFamily: 'Tajawal, sans-serif', minHeight: 80 }}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontFamily: 'Tajawal, sans-serif' }}>
                {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> جاري الإرسال...</> : 'إرسال للمراجعة'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
