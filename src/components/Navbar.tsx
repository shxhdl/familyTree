import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TreePine, User as UserIcon, LogOut, Shield, Menu, X, Bell, Compass } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const { user, authUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [memberRequestsCount, setMemberRequestsCount] = useState<number>(0);
  const [pendingPublishCount, setPendingPublishCount] = useState<number>(0);

  // Load pending access requests count and tree publish requests for admin or tree owner
  useEffect(() => {
    if (!user) return;

    const fetchPendingCount = async () => {
      try {
        if (authUser?.is_admin) {
          const [{ count: accessCount }, { count: pubCount }] = await Promise.all([
            supabase
              .from('tree_access_requests')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'pending'),
            supabase
              .from('family_trees')
              .select('*', { count: 'exact', head: true })
              .eq('publish_status', 'pending_approval'),
          ]);

          if (accessCount !== null) setPendingRequestsCount(accessCount);
          if (pubCount !== null) setPendingPublishCount(pubCount);
        } else {
          // Regular member: check requests for trees they created
          const { data: myTrees } = await supabase
            .from('family_trees')
            .select('id')
            .eq('created_by', user.id);

          const myTreeIds = (myTrees || []).map(t => t.id);
          if (myTreeIds.length > 0) {
            const { count, error } = await supabase
              .from('tree_access_requests')
              .select('*', { count: 'exact', head: true })
              .in('tree_id', myTreeIds)
              .eq('status', 'pending');

            if (!error && count !== null) {
              setMemberRequestsCount(count);
            }
          } else {
            setMemberRequestsCount(0);
          }
        }
      } catch {
        // Table may not exist yet or no access
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 15000);
    return () => clearInterval(interval);
  }, [user, authUser?.is_admin]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Determine user display name dynamically from account
  const displayName = authUser?.profile?.full_name?.trim() || user?.email?.split('@')[0] || 'مستخدم';

  return (
    <nav className="navbar" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', flexShrink: 0
          }}>
            <TreePine size={22} />
          </div>
          <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>شجرة العائلة</span>
        </Link>

        {/* Desktop nav */}
        <ul className="navbar-nav" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <li>
            <Link to="/" className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}>
              الرئيسية
            </Link>
          </li>
          {user && (
            <li>
              <Link
                to="/my-trees"
                className={`navbar-link ${location.pathname === '/my-trees' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Compass size={16} />
                <span>أشجاري</span>
                {memberRequestsCount > 0 && (
                  <span style={{
                    background: '#f59e0b',
                    color: '#ffffff',
                    fontSize: '0.70rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    lineHeight: 1.2,
                  }}>
                    {memberRequestsCount}
                  </span>
                )}
              </Link>
            </li>
          )}
          {authUser?.is_admin && (
            <li>
              <Link
                to="/admin"
                className={`navbar-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Shield size={16} style={{ color: 'var(--color-primary)' }} />
                <span>لوحة الإدارة</span>
                {pendingRequestsCount + pendingPublishCount > 0 && (
                  <span
                    style={{
                      background: 'var(--color-danger)',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-full)',
                      padding: '1px 7px',
                      lineHeight: '1.4',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                    title={`لديك ${pendingRequestsCount + pendingPublishCount} إشعار جديد (${pendingPublishCount} طلب نشر شجرة, ${pendingRequestsCount} طلب وصول)`}
                  >
                    <Bell size={10} />
                    {pendingRequestsCount + pendingPublishCount}
                  </span>
                )}
              </Link>
            </li>
          )}
        </ul>

        {/* Auth actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* User profile & badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: authUser?.is_admin ? 'linear-gradient(135deg, #1e40af, #3b82f6)' : 'var(--color-surface-2)',
                  border: authUser?.is_admin ? '2px solid #60a5fa' : '1px solid var(--color-border)',
                  color: authUser?.is_admin ? 'white' : 'var(--color-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem'
                }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontFamily: 'Tajawal, sans-serif'
                  }}>
                    {displayName}
                  </div>
                  {authUser?.is_admin ? (
                    <span
                      className="badge badge-blue"
                      style={{
                        fontSize: '0.68rem',
                        padding: '1px 6px',
                        marginTop: 2,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Shield size={10} />
                      مسؤول النظام
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      عضو مسجل
                    </span>
                  )}
                </div>
              </div>

              {/* Logout button */}
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleSignOut}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px' }}
                title="تسجيل الخروج"
              >
                <LogOut size={15} />
                <span className="hidden-mobile" style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.8rem' }}>خروج</span>
              </button>
            </div>
          ) : (
            <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link to="/auth" className="btn btn-secondary btn-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                تسجيل الدخول
              </Link>
              <Link to="/auth?tab=signup" className="btn btn-primary btn-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                إنشاء حساب
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="btn btn-ghost btn-icon mobile-only"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="القائمة"
            style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', padding: 0 }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div style={{
          background: 'var(--color-surface)',
          borderBottom: '2px solid var(--color-border)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: 'var(--shadow-md)',
          animation: 'slideUp 0.2s ease',
        }}>
          <Link
            to="/"
            onClick={() => setMenuOpen(false)}
            className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: '1rem', fontWeight: 700 }}
          >
            <TreePine size={18} />
            <span>الرئيسية</span>
          </Link>

          {user && (
            <Link
              to="/my-trees"
              onClick={() => setMenuOpen(false)}
              className={`navbar-link ${location.pathname === '/my-trees' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: '1rem', fontWeight: 700 }}
            >
              <Compass size={18} />
              <span>أشجاري</span>
              {memberRequestsCount > 0 && (
                <span className="badge badge-orange" style={{ fontSize: '0.72rem', marginRight: 'auto' }}>
                  {memberRequestsCount} طلب
                </span>
              )}
            </Link>
          )}

          {authUser?.is_admin && (
            <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className={`navbar-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: '1rem', fontWeight: 700 }}
            >
              <Shield size={18} />
              <span>لوحة الإدارة</span>
              {(pendingRequestsCount > 0 || pendingPublishCount > 0) && (
                <span className="badge badge-red" style={{ fontSize: '0.72rem', marginRight: 'auto' }}>
                  {pendingRequestsCount + pendingPublishCount} تنبيه
                </span>
              )}
            </Link>
          )}

          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'var(--color-primary)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.95rem'
                }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {authUser?.is_admin ? 'مسؤول النظام' : 'عضو مسجل'}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => { setMenuOpen(false); handleSignOut(); }}
                style={{ width: '100%', justifyContent: 'center', gap: 8, color: 'var(--color-danger)' }}
              >
                <LogOut size={16} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link
                to="/auth"
                onClick={() => setMenuOpen(false)}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                تسجيل الدخول
              </Link>
              <Link
                to="/auth?tab=signup"
                onClick={() => setMenuOpen(false)}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                إنشاء حساب جديد
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
