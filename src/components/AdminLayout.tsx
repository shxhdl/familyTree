import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { LayoutDashboard, TreePine, Users, ClipboardList, ShieldCheck, UserCog, ChevronRight, Shield, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AdminLayout({ children, title, subtitle }: Props) {
  const { authUser } = useAuth();
  const location = useLocation();
  const [pendingAccessCount, setPendingAccessCount] = useState<number>(0);
  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState<number>(0);
  const [pendingPublishCount, setPendingPublishCount] = useState<number>(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Only count requests for platform/system trees or public trees (not members' private trees)
        const { data: allTrees } = await supabase
          .from('family_trees')
          .select('id, created_by, visibility');

        const systemTreeIds = (allTrees || [])
          .filter(t => !t.created_by || t.visibility === 'public')
          .map(t => t.id);

        let accessCount = 0;
        if (systemTreeIds.length > 0) {
          const { count } = await supabase
            .from('tree_access_requests')
            .select('*', { count: 'exact', head: true })
            .in('tree_id', systemTreeIds)
            .eq('status', 'pending');
          accessCount = count || 0;
        }

        const [{ count: subsCount }, { count: pubCount }] = await Promise.all([
          supabase
            .from('pending_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('family_trees')
            .select('*', { count: 'exact', head: true })
            .eq('publish_status', 'pending_approval'),
        ]);

        if (accessCount !== null) setPendingAccessCount(accessCount);
        if (subsCount !== null) setPendingSubmissionsCount(subsCount || 0);
        if (pubCount !== null) setPendingPublishCount(pubCount || 0);
      } catch {
        // Tables may not exist yet
      }
    };

    fetchCounts();
    const timer = setInterval(fetchCounts, 15000);
    return () => clearInterval(timer);
  }, []);

  const displayName = authUser?.profile?.full_name?.trim() || 'مسؤول النظام';

  const navItems = [
    { to: '/admin', label: 'لوحة التحكم', labelEn: 'Dashboard', icon: <LayoutDashboard size={18} />, exact: true },
    {
      to: '/admin/access-requests',
      label: 'طلبات الوصول',
      labelEn: 'Access Requests',
      icon: <ShieldCheck size={18} />,
      badge: pendingAccessCount > 0 ? pendingAccessCount : null,
      badgeColor: undefined,
    },
    { to: '/admin/users', label: 'إدارة الصلاحيات', labelEn: 'Permissions & Users', icon: <UserCog size={18} /> },
    {
      to: '/admin/trees',
      label: 'الأشجار العائلية',
      labelEn: 'Family Trees',
      icon: <TreePine size={18} />,
      badge: pendingPublishCount > 0 ? `${pendingPublishCount} طلب نشر` : null,
      badgeColor: '#b45309',
    },
    { to: '/admin/members', label: 'إدارة الأعضاء', labelEn: 'Members', icon: <Users size={18} /> },
    {
      to: '/admin/submissions',
      label: 'طلبات المراجعة',
      labelEn: 'Submissions',
      icon: <ClipboardList size={18} />,
      badge: pendingSubmissionsCount > 0 ? pendingSubmissionsCount : null,
      badgeColor: undefined,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />

      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 4 }}>
              <div style={{
                width: 38, height: 38, background: 'linear-gradient(135deg, var(--color-primary), #0284c7)',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '0.95rem', fontWeight: 800, flexShrink: 0
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-main)', fontFamily: 'Tajawal, sans-serif', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                <div className="badge badge-blue" style={{ fontSize: '0.68rem', padding: '1px 6px', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Shield size={10} />
                  مسؤول النظام
                </div>
              </div>
            </div>
          </div>

          <div className="divider" style={{ margin: '0 0 8px' }} />

          <div className="sidebar-title">القائمة الرئيسية</div>
          {navItems.map(item => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar-link ${active ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                {item.icon}
                <span style={{ fontFamily: 'Tajawal, sans-serif', flex: 1 }}>{item.label}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    style={{
                      background: item.badgeColor || 'var(--color-danger)',
                      color: 'white',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-full)',
                      padding: '1px 6px',
                      marginLeft: 4,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {active && <ChevronRight size={14} style={{ color: 'var(--color-primary)' }} />}
              </Link>
            );
          })}

          <div className="divider" />
          <div className="sidebar-title">روابط سريعة</div>
          <Link to="/" className="sidebar-link">
            <TreePine size={16} />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>عرض الموقع</span>
          </Link>
          <Link to="/my-trees" className="sidebar-link">
            <ShieldCheck size={16} />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>أشجاري المتاحة</span>
          </Link>
        </aside>

        {/* Content */}
        <main className="admin-content">
          {/* Notification banner for pending tree publishing */}
          {pendingPublishCount > 0 && location.pathname !== '/admin/trees' && (
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1.5px solid #fcd34d',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 18px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              boxShadow: '0 2px 8px rgba(217,119,6,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#f59e0b',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Bell size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#92400e', fontFamily: 'Tajawal, sans-serif' }}>
                    تنبيه: يوجد {pendingPublishCount} طلب نشر عام لشجرة عائلية جديدة!
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#b45309', fontFamily: 'Tajawal, sans-serif' }}>
                    قام عضو في المنصة بطلب نشر شجرته الخاصة في المنصة العامة، وهي بانتظار موافقتك.
                  </div>
                </div>
              </div>

              <Link
                to="/admin/trees?tab=pending"
                className="btn btn-primary btn-sm"
                style={{
                  background: '#d97706',
                  borderColor: '#d97706',
                  color: 'white',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Tajawal, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                مراجعة الطلبات ({pendingPublishCount})
              </Link>
            </div>
          )}

          <div style={{ marginBottom: 28 }}>
            <h1 className="page-title" style={{ fontFamily: 'Tajawal, sans-serif' }}>{title}</h1>
            {subtitle && <p style={{ color: 'var(--color-text-muted)', marginTop: 4, fontSize: '0.95rem' }}>{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
