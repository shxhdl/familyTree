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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            aria-label="Menu"
            style={{ display: 'none' }}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <Link to="/" onClick={() => setMenuOpen(false)} className="navbar-link">الرئيسية</Link>
          {user && (
            <Link to="/my-trees" onClick={() => setMenuOpen(false)} className="navbar-link">أشجاري</Link>
          )}
          {authUser?.is_admin && (
            <Link to="/admin" onClick={() => setMenuOpen(false)} className="navbar-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={16} />
              <span>لوحة الإدارة</span>
              {pendingRequestsCount > 0 && (
                <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>{pendingRequestsCount} معلق</span>
              )}
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
