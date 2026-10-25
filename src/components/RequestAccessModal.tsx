import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, Send, AlertCircle, CheckCircle, ShieldCheck, TreePine } from 'lucide-react';
import type { FamilyTree } from '@/types';

interface Props {
  tree: FamilyTree;
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted: () => void;
}

export default function RequestAccessModal({ tree, isOpen, onClose, onRequestSubmitted }: Props) {
  const { user, authUser } = useAuth();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('يجب تسجيل الدخول أولاً لتقديم طلب الوصول');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Check if user already has a pending request
      const { data: existing, error: checkErr } = await supabase
        .from('tree_access_requests')
        .select('id, status')
        .eq('tree_id', tree.id)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (checkErr && (checkErr.message?.includes('tree_access_requests') || checkErr.message?.includes('schema cache'))) {
        setError('جدول طلبات الوصول لم يتم تفعيله في قاعدة البيانات بعد. يرجى من مدير النظام تشغيل ملف SQL في Supabase.');
        setSubmitting(false);
        return;
      }

      if (!checkErr && existing) {
        setError('لديك بالفعل طلب وصول قيد المراجعة لهذه الشجرة. يرجى انتظار رد الإدارة.');
        setSubmitting(false);
        return;
      }

      // Submit new access request
      const { error: insertErr } = await supabase
        .from('tree_access_requests')
        .insert({
          tree_id: tree.id,
          user_id: user.id,
          status: 'pending',
          request_note: note.trim() || null,
        });

      if (insertErr) {
        // If unique index violation
        if (insertErr.code === '23505' || insertErr.message?.includes('unique')) {
          setError('لديك بالفعل طلب وصول قيد المراجعة لهذه الشجرة.');
        } else if (insertErr.message?.includes('tree_access_requests') || insertErr.message?.includes('schema cache')) {
          setError('جدول طلبات الوصول لم يتم إنشاؤه في قاعدة البيانات بعد. يرجى من مدير النظام تشغيل ملف SQL في Supabase لتفعيل نظام الطلبات.');
        } else {
          setError('حدث خطأ أثناء إرسال الطلب: ' + insertErr.message);
        }
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      onRequestSubmitted();
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setNote('');
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلب، يرجى المحاولة لاحقاً');
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = authUser?.profile?.full_name?.trim() || user?.email || '';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-slideUp" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: '#dbeafe', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.15rem', margin: 0 }}>
                طلب تصريح الوصول إلى الشجرة
              </h2>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#d1fae5',
              color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle size={32} />
            </div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif', color: '#065f46', marginBottom: 8 }}>
              تم إرسال طلب الوصول بنجاح!
            </h3>
            <p style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              تم استلام طلبك للانضمام إلى <strong>{tree.name_ar}</strong>، وسيقوم مسؤول النظام بمراجعته وتحديد الصلاحيات الممنوحة لك قريباً.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-error" style={{ fontFamily: 'Tajawal, sans-serif', marginBottom: 16 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Tree Summary Box */}
              <div style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', flexShrink: 0
                }}>
                  <TreePine size={24} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '1rem' }}>
                    {tree.name_ar}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    مقدم الطلب: {displayName}
                  </div>
                </div>
              </div>

              <div className="alert alert-info" style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.85rem', marginBottom: 16 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>
                  تفاصيل شجرة العائلة وأسماء أفرادها خاصة ومحمية. بعد تقديم الطلب، سيقوم مسؤول النظام بمراجعة طلبك ومنحك الصلاحيات المناسبة.
                </span>
              </div>

              {/* Note input */}
              <div className="form-group">
                <label className="form-label" htmlFor="request-note" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  صلة القرابة أو سبب الطلب (اختياري)
                </label>
                <textarea
                  id="request-note"
                  className="form-textarea"
                  rows={3}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="مثال: أنا حفيد فلان، أو صلة قرابتي بالعائلة هي..."
                  style={{ fontFamily: 'Tajawal, sans-serif', resize: 'vertical' }}
                  maxLength={500}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'left', display: 'block' }}>
                  {note.length}/500
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={submitting}
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ fontFamily: 'Tajawal, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    إرسال طلب الوصول
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
