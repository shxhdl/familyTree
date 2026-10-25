import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { TreePine, Users, ClipboardList, CheckCircle, Clock, ShieldCheck, UserCog, ArrowRight, Shield, Globe, Bell } from 'lucide-react';

interface Stats {
  trees: number;
  persons: number;
  registeredUsers: number;
  pendingAccessRequests: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  pendingPublishTrees: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    trees: 0,
    persons: 0,
    registeredUsers: 0,
    pendingAccessRequests: 0,
    pendingSubmissions: 0,
    approvedSubmissions: 0,
    pendingPublishTrees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTrees, setRecentTrees] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [
        { count: treesCount },
        { count: personsCount },
        { count: usersCount },
        { count: accessRequestsCount },
        { count: pendingSubmissionsCount },
        { count: approvedSubmissionsCount },
        { count: pendingPublishCount },
        { data: treesData },
      ] = await Promise.all([
        supabase.from('family_trees').select('*', { count: 'exact', head: true }),
        supabase.from('persons').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('tree_access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('pending_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('pending_submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('family_trees').select('*', { count: 'exact', head: true }).eq('publish_status', 'pending_approval'),
        supabase.from('family_trees').select('*, family_tree_members(count)').order('created_at', { ascending: false }).limit(4),
      ]);

      setStats({
        trees: treesCount ?? 0,
        persons: personsCount ?? 0,
        registeredUsers: usersCount ?? 0,
        pendingAccessRequests: accessRequestsCount ?? 0,
        pendingSubmissions: pendingSubmissionsCount ?? 0,
        approvedSubmissions: approvedSubmissionsCount ?? 0,
        pendingPublishTrees: pendingPublishCount ?? 0,
      });

      setRecentTrees((treesData || []).map((t: any) => ({
        ...t,
        member_count: t.family_tree_members?.[0]?.count ?? 0,
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'طلبات الوصول المعلقة',
      labelEn: 'Pending Access Requests',
      value: stats.pendingAccessRequests,
      icon: <ShieldCheck size={24} />,
      color: stats.pendingAccessRequests > 0 ? '#d97706' : '#2563eb',
      bg: stats.pendingAccessRequests > 0 ? '#fef3c7' : '#dbeafe',
      link: '/admin/access-requests',
      highlight: stats.pendingAccessRequests > 0,
    },
    {
      label: 'طلبات نشر الأشجار',
      labelEn: 'Pending Tree Publish',
      value: stats.pendingPublishTrees,
      icon: <Globe size={24} />,
      color: stats.pendingPublishTrees > 0 ? '#b45309' : '#0284c7',
      bg: stats.pendingPublishTrees > 0 ? '#fef3c7' : '#e0f2fe',
      link: '/admin/trees?tab=pending',
      highlight: stats.pendingPublishTrees > 0,
    },
    {
      label: 'المستخدمون المسجلون',
      labelEn: 'Registered Accounts',
      value: stats.registeredUsers,
      icon: <UserCog size={24} />,
      color: '#7c3aed',
      bg: '#ede9fe',
      link: '/admin/users',
    },
    {
      label: 'الأشجار العائلية',
      labelEn: 'Family Trees',
      value: stats.trees,
      icon: <TreePine size={24} />,
      color: 'var(--color-primary)',
      bg: '#dbeafe',
      link: '/admin/trees',
    },
    {
      label: 'إجمالي أفراد العائلات',
      labelEn: 'Total Persons',
      value: stats.persons,
      icon: <Users size={24} />,
      color: '#059669',
      bg: '#d1fae5',
      link: '/admin/members',
    },
  ];

  return (
    <AdminLayout title="لوحة التحكم" subtitle="Dashboard Overview">
      {loading ? (
        <div className="loading-center" style={{ minHeight: 300 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {/* Actionable Alert Banner for Pending Tree Publish */}
          {stats.pendingPublishTrees > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '2px solid #f59e0b',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: '#d97706',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Globe size={22} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'Tajawal, sans-serif', margin: '0 0 2px', color: '#78350f', fontSize: '1.05rem', fontWeight: 800 }}>
                    🔔 إشعار عاجل: يوجد {stats.pendingPublishTrees} طلب نشر عام لشجرة عائلية جديدة!
                  </h3>
                  <p style={{ margin: 0, color: '#92400e', fontSize: '0.85rem', fontFamily: 'Tajawal, sans-serif' }}>
                    قام عضو في المنصة بطلب اعتماد شجرته ونشرها مع باقي الأشجار العامة. يمكنك مراجعتها وقبولها أو رفضها الآن.
                  </p>
                </div>
              </div>
              <Link
                to="/admin/trees?tab=pending"
                className="btn btn-primary"
                style={{
                  background: '#b45309',
                  borderColor: '#b45309',
                  color: 'white',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Tajawal, sans-serif',
                  fontWeight: 700,
                }}
              >
                مراجعة واعتماد طلبات النشر ({stats.pendingPublishTrees})
              </Link>
            </div>
          )}

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
            {statCards.map((stat, i) => (
              <Link key={i} to={stat.link} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: stat.highlight ? '2px solid #f59e0b' : '1px solid var(--color-border)',
                    boxShadow: stat.highlight ? '0 4px 12px rgba(245, 158, 11, 0.15)' : undefined,
                  }}
                >
                  <div className="card-body" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '2.25rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                          {stat.value}
                        </div>
                        <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, color: 'var(--color-text-main)', marginTop: 8 }}>
                          {stat.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {stat.labelEn}
                        </div>
                      </div>
                      <div style={{
                        width: 48, height: 48, borderRadius: 'var(--radius-md)',
                        background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: stat.color, flexShrink: 0,
                      }}>
                        {stat.icon}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Quick actions */}
          <div>
            <h2 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>
              إجراءات سريعة
            </h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/admin/access-requests" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} />
                <span>طلبات الوصول للأشجار</span>
                {stats.pendingAccessRequests > 0 && (
                  <span style={{
                    background: '#d97706', color: 'white',
                    borderRadius: 'var(--radius-full)', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 800,
                  }}>
                    {stats.pendingAccessRequests} معلق
                  </span>
                )}
              </Link>
              <Link to="/admin/trees?tab=pending" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={16} />
                <span>طلبات نشر الأشجار</span>
                {stats.pendingPublishTrees > 0 && (
                  <span style={{
                    background: '#b45309', color: 'white',
                    borderRadius: 'var(--radius-full)', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 800,
                  }}>
                    {stats.pendingPublishTrees} بانتظار الاعتماد
                  </span>
                )}
              </Link>
              <Link to="/admin/users" className="btn btn-secondary">
                <UserCog size={16} /> إدارة الصلاحيات
              </Link>
              <Link to="/admin/trees" className="btn btn-secondary">
                <TreePine size={16} /> إضافة شجرة جديدة
              </Link>
              <Link to="/admin/members" className="btn btn-secondary">
                <Users size={16} /> إضافة عضو
              </Link>
            </div>
          </div>

          {/* Recent Trees */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.2rem', fontWeight: 700 }}>
                أحدث الأشجار العائلية
              </h2>
              <Link to="/admin/trees" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                عرض الكل <ArrowRight size={14} />
              </Link>
            </div>

            {recentTrees.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-icon">🌳</div>
                <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>لا توجد أشجار بعد</h3>
                <Link to="/admin/trees" className="btn btn-primary" style={{ marginTop: 16 }}>
                  إنشاء أول شجرة
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {recentTrees.map(tree => (
                  <div key={tree.id} className="card" style={{ padding: 0 }}>
                    <div style={{
                      height: 100,
                      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
                      borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {tree.cover_image_url
                        ? <img src={tree.cover_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} alt="" />
                        : <TreePine size={36} color="rgba(255,255,255,.8)" />
                      }
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, direction: 'rtl', fontSize: '1rem' }}>
                        {tree.name_ar}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                        <span className={`badge ${tree.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                          {tree.status === 'active' ? 'نشط' : 'مؤرشف'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontFamily: 'Tajawal, sans-serif' }}>
                          {tree.member_count} عضو
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
