import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TreePine, Eye, EyeOff, AlertCircle } from 'lucide-react';

type Tab = 'signin' | 'signup';

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'signup' ? 'signup' : 'signin');

  const [form, setForm] = useState({ email: '', password: '', fullName: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('يرجى تعبئة جميع الحقول'); return; }
    setLoading(true);
    const { error: err } = await signIn(form.email, form.password);
    setLoading(false);
    if (err) setError(translateError(err));
    else navigate('/');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.fullName) { setError('يرجى تعبئة جميع الحقول'); return; }
    if (form.password !== form.confirmPassword) { setError('كلمتا المرور غير متطابقتين'); return; }
    if (form.password.length < 6) { setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل'); return; }
    setLoading(true);
    const { error: err } = await signUp(form.email, form.password, form.fullName);
    setLoading(false);
    if (err) setError(translateError(err));
    else setSuccess('تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني للتفعيل.');
  };

  const translateError = (msg: string) => {
    if (msg.includes('Invalid login')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    if (msg.includes('Email not confirmed')) return 'يرجى تأكيد بريدك الإلكتروني أولاً';
    if (msg.includes('already registered')) return 'هذا البريد مسجل مسبقاً';
    if (msg.includes('rate limit')) return 'محاولات كثيرة، يرجى الانتظار';
    return msg;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eef3ff 0%, #f0f5ff 50%, #e8f0fe 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-lg)',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 64, height: 64,
              background: 'var(--color-primary)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(26,86,219,.35)',
            }}>
              <TreePine size={32} color="white" />
            </div>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Tajawal, sans-serif' }}>
              شجرة العائلة
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="card animate-slideUp" style={{ borderRadius: 'var(--radius-xl)' }}>
          {/* Tabs */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid var(--color-border)',
          }}>
            {(['signin', 'signup'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                style={{
                  padding: '16px',
                  border: 'none',
                  background: tab === t ? 'white' : 'var(--color-surface-2)',
                  color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: tab === t ? 700 : 500,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  fontFamily: 'Tajawal, sans-serif',
                  borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {t === 'signin' ? 'تسجيل الدخول' : 'حساب جديد'}
              </button>
            ))}
          </div>

          <div className="card-body" style={{ padding: 28 }}>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success" style={{ marginBottom: 16, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                {success}
              </div>
            )}

            {tab === 'signin' ? (
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="email-signin" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                    البريد الإلكتروني
                  </label>
                  <input
                    id="email-signin"
                    className="form-input"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="example@email.com"
                    autoComplete="email"
                    dir="ltr"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password-signin" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                    كلمة المرور
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password-signin"
                      className="form-input"
                      type={showPass ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      dir="ltr"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> جاري الدخول...</> : 'تسجيل الدخول'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="fullname-signup" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                    الاسم الكامل
                  </label>
                  <input
                    id="fullname-signup"
                    className="form-input"
                    type="text"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    placeholder="اسمك الكامل"
                    style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="email-signup" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                    البريد الإلكتروني
                  </label>
                  <input
                    id="email-signup"
                    className="form-input"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password-signup" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                    كلمة المرور
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password-signup"
                      className="form-input"
                      type={showPass ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      dir="ltr"
                      style={{ paddingRight: 44 }}
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-password" style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
                    تأكيد كلمة المرور
                  </label>
                  <input
                    id="confirm-password"
                    className="form-input"
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    dir="ltr"
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> جاري الإنشاء...</> : 'إنشاء الحساب'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          <Link to="/" style={{ color: 'var(--color-primary)' }}>← العودة للرئيسية</Link>
        </p>
      </div>
    </div>
  );
}
