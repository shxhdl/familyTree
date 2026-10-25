import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import RequestAccessModal from '@/components/RequestAccessModal';
import {
  Search,
  TreePine,
  Users,
  ChevronRight,
  Plus,
  ShieldCheck,
  Clock,
  Lock,
  Layers,
  LogIn,
  UserPlus,
  Sparkles,
  Bell,
  Shield,
  ArrowRight,
  Eye,
} from 'lucide-react';
import type { FamilyTree, TreeAccessRequest, FamilyTreePermission } from '@/types';

export default function HomePage() {
  const { user, authUser } = useAuth();
  const navigate = useNavigate();

  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Stats
  const [registeredUsersCount, setRegisteredUsersCount] = useState<number>(0);
  const [totalPersonsCount, setTotalPersonsCount] = useState<number>(0);
  const [adminPendingRequestsCount, setAdminPendingRequestsCount] = useState<number>(0);

  // Access requests & permissions tracking for logged in user
  const [userPermsMap, setUserPermsMap] = useState<Map<string, FamilyTreePermission>>(new Map());
  const [userRequestsMap, setUserRequestsMap] = useState<Map<string, TreeAccessRequest>>(new Map());

  // Request Access Modal
  const [selectedTreeForRequest, setSelectedTreeForRequest] = useState<FamilyTree | null>(null);

  // Login prompt modal
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pendingTreeForLogin, setPendingTreeForLogin] = useState<FamilyTree | null>(null);

  useEffect(() => {
    loadTreesAndStats();
  }, [user, authUser]);

  const loadTreesAndStats = async () => {
    setLoading(true);
    try {
      // 1. Load active family trees
      const { data: treesData, error: treesErr } = await supabase
        .from('family_trees')
        .select(`*, family_tree_members(count)`)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (treesErr) throw treesErr;

      // Only show published public trees on the homepage feed
      const publicTrees = (treesData || []).filter((t: any) => {
        if (t.publish_status && t.publish_status !== 'published') {
          return false;
        }
        if (t.visibility && t.visibility !== 'public') {
          return false;
        }
        return true;
      });

      // 2. Load Real Registered Users count & total persons count
      try {
        const { data: statsData, error: rpcErr } = await supabase.rpc('get_platform_stats');
        if (!rpcErr && statsData) {
          setRegisteredUsersCount(Number(statsData.users_count) || 0);
          setTotalPersonsCount(Number(statsData.persons_count) || 0);
        } else {
          // Fallback direct count
          const [{ count: uCount }, { count: pCount }] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('persons').select('*', { count: 'exact', head: true }),
          ]);
          setRegisteredUsersCount(uCount ?? 0);
          setTotalPersonsCount(pCount ?? 0);
        }
      } catch {
        // Fallback
        const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        setRegisteredUsersCount(uCount ?? 0);
      }

      // 3. If user is logged in, load user's permissions and pending access requests
      const permsMap = new Map<string, FamilyTreePermission>();
      const reqsMap = new Map<string, TreeAccessRequest>();

      if (user) {
        try {
          const [{ data: perms }, { data: reqs }] = await Promise.all([
            supabase
              .from('family_tree_permissions')
              .select('*')
              .eq('user_id', user.id),
            supabase
              .from('tree_access_requests')
              .select('*')
              .eq('user_id', user.id),
          ]);

          perms?.forEach(p => permsMap.set(p.tree_id, p as any));
          reqs?.forEach(r => reqsMap.set(r.tree_id, r as any));
        } catch {
          // Table may not exist yet
        }

        // If admin, check total pending requests count
        if (authUser?.is_admin) {
          try {
            const { count } = await supabase
              .from('tree_access_requests')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'pending');
            setAdminPendingRequestsCount(count ?? 0);
          } catch {}
        }
      }

      setUserPermsMap(permsMap);
      setUserRequestsMap(reqsMap);

      // Map trees with member count and access status
      const mapped = (publicTrees || []).map((t: any) => {
        const perm = permsMap.get(t.id);
        const req = reqsMap.get(t.id);
        const hasAccess =
          authUser?.is_admin === true ||
          (perm?.can_view_tree === true && perm?.is_suspended !== true);

        return {
          ...t,
          member_count: t.family_tree_members?.[0]?.count ?? 0,
          has_access: hasAccess,
          user_granular_permissions: perm,
          pending_request: req?.status === 'pending' ? req : null,
        };
      });

      setTrees(mapped);
    } catch (err) {
      console.error('Error loading trees:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return trees.filter(t =>
      t.name_ar.toLowerCase().includes(search.toLowerCase()) ||
      t.name_en.toLowerCase().includes(search.toLowerCase()) ||
      (t.description_ar || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [trees, search]);

  const handleTreeAction = (tree: FamilyTree) => {
    if (tree.has_access) {
      // User has access -> open tree
      navigate(`/trees/${tree.id}`);
      return;
    }

    // User does not have access
    if (!user) {
      // Not logged in -> show login prompt
      setPendingTreeForLogin(tree);
      setShowLoginPrompt(true);
      return;
    }

    // Logged in -> open access request modal
    setSelectedTreeForRequest(tree);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />

      {/* Hero Section — Sleek, balanced height and width, elegant blue design */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2b5c 0%, #1a4fba 45%, #0284c7 100%)',
          color: 'white',
          padding: '36px 20px 32px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background glow effect */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '10%',
          width: 320,
          height: 320,
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="container" style={{ maxWidth: 960, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Top subtle badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', padding: '4px 14px', borderRadius: 'var(--radius-full)', marginBottom: 14, fontSize: '0.82rem', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Sparkles size={14} color="#fde047" />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>منظومة متكاملة لتوثيق الأنساب والأجيال</span>
          </div>

          {/* Exact Main Title: منصة شجرة عائلتك */}
          <h1
            style={{
              fontSize: 'clamp(1.9rem, 4vw, 2.7rem)',
              fontFamily: 'Tajawal, sans-serif',
              fontWeight: 800,
              margin: '0 0 10px',
              lineHeight: 1.25,
              textShadow: '0 2px 10px rgba(0,0,0,0.15)',
            }}
          >
            منصة شجرة عائلتك
          </h1>

          {/* Exact Subtitle: استعرض شجرات عائلتك وتواصل معهم عبر الأجيال */}
          <p
            style={{
              fontFamily: 'Tajawal, sans-serif',
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              fontWeight: 500,
              opacity: 0.95,
              margin: authUser?.is_admin ? '0 auto 24px' : '0 auto 8px',
              maxWidth: 620,
              lineHeight: 1.5,
            }}
          >
            استعرض شجرات عائلتك وتواصل معهم عبر الأجيال
          </p>

          {/* Stats Bar — Only visible to system admins, hidden from registered members */}
          {authUser?.is_admin && (
            <div
              style={{
                display: 'inline-grid',
                gridTemplateColumns: 'repeat(3, minmax(110px, 160px))',
                gap: 'clamp(12px, 3vw, 24px)',
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(12px)',
                padding: '14px 24px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Stat 1: الأشجار العائلية */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)', fontWeight: 800, lineHeight: 1 }}>
                  {trees.length}
                </div>
                <div style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.8rem', opacity: 0.9, marginTop: 4 }}>
                  أشجار عائلية
                </div>
              </div>

              {/* Stat 2: الأعضاء المسجلين */}
              <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)', fontWeight: 800, lineHeight: 1, color: '#fef08a' }}>
                  {registeredUsersCount}
                </div>
                <div style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.8rem', opacity: 0.9, marginTop: 4 }}>
                  الأعضاء المسجلين
                </div>
              </div>

              {/* Stat 3: أفراد العائلات الموثقين */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)', fontWeight: 800, lineHeight: 1 }}>
                  {totalPersonsCount > 0 ? totalPersonsCount : trees.reduce((a, t) => a + (t.member_count || 0), 0)}
                </div>
                <div style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.8rem', opacity: 0.9, marginTop: 4 }}>
                  أفراد العائلات
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container" style={{ padding: '36px var(--space-lg)' }}>
        {/* Admin Pending Requests Notification Banner */}
        {authUser?.is_admin && adminPendingRequestsCount > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1.5px solid #fde68a',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
            boxShadow: '0 4px 14px rgba(217, 119, 6, 0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#fef08a', color: '#b45309',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bell size={20} />
              </div>
              <div>
                <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '0.98rem', color: '#92400e' }}>
                  يوجد {adminPendingRequestsCount} طلبات تصريح دخول جديدة بانتظار قرارك
                </div>
                <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: 2 }}>
                  بصفتك مسؤول النظام، يمكنك قبول الطلب وتحديد نوع التصريح (مشاهدة فقط، محرر ومساهم، مشرف الشجرة) أو رفضه.
                </div>
              </div>
            </div>
            <Link
              to="/admin/access-requests"
              className="btn btn-sm btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-full)' }}
            >
              <Shield size={15} />
              <span>مراجعة الطلبات وتحديد نوع التصريح</span>
            </Link>
          </div>
        )}

        {/* Search + Actions Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 28,
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Tajawal, sans-serif', margin: 0 }}>
              الأشجار العائلية
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 3 }}>
              {authUser?.is_admin
                ? 'استعراض وإدارة كافة الأشجار العائلية في المنصة'
                : 'استعرض شجرتك المصرح لك بها، أو اطلب تصريح الوصول للاطلاع على باقي العائلات'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ minWidth: 260 }}>
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="ابحث عن عائلة أو شجرة..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="search-trees"
              />
            </div>
            {authUser?.is_admin && (
              <Link to="/admin/trees" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} />
                <span>إضافة شجرة</span>
              </Link>
            )}
          </div>
        </div>

        {/* Trees Grid */}
        {loading ? (
          <div className="loading-center">
            <div className="spinner" />
            <span style={{ fontFamily: 'Tajawal, sans-serif' }}>جاري تحميل الأشجار العائلية...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌳</div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {search ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد أشجار عائلية معلنة حالياً'}
            </h3>
            <p style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {search ? 'جرب البحث بكلمات أخرى' : 'سيتم إضافة الأشجار العائلية قريباً من قبل إدارة المنصة'}
            </p>
            {!search && authUser?.is_admin && (
              <Link to="/admin/trees" className="btn btn-primary" style={{ marginTop: 20 }}>
                <Plus size={16} /> إنشاء أول شجرة
              </Link>
            )}
          </div>
        ) : (
          <div className="grid-cards animate-fadeIn">
            {filtered.map(tree => {
              const hasAccess = tree.has_access;
              const isPending = !!tree.pending_request;

              return (
                <div
                  key={tree.id}
                  className="tree-card"
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  {/* Status Badge */}
                  <div className="tree-card-status">
                    {authUser?.is_admin ? (
                      <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700 }}>
                        <ShieldCheck size={13} />
                        صلاحية كاملة (مدير النظام)
                      </span>
                    ) : hasAccess ? (
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                        <ShieldCheck size={13} />
                        مصرح لك بالوصول
                      </span>
                    ) : isPending ? (
                      <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fefce8', color: '#b45309', border: '1px solid #fde047', fontWeight: 700 }}>
                        <Clock size={13} />
                        طلبك قيد المراجعة
                      </span>
                    ) : (
                      <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                        <Lock size={13} />
                        يتطلب تصريح وصول
                      </span>
                    )}
                  </div>

                  {/* Cover */}
                  {tree.cover_image_url ? (
                    <img src={tree.cover_image_url} alt={tree.name_ar} className="tree-card-cover" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="tree-card-cover" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)' }}>
                      <TreePine size={52} color="rgba(255,255,255,0.9)" />
                    </div>
                  )}

                  {/* Body */}
                  <div className="tree-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="tree-card-name-ar">{tree.name_ar}</div>
                    {tree.name_en && <div className="tree-card-name-en">{tree.name_en}</div>}

                    {tree.description_ar && (
                      <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--color-text-muted)',
                        marginTop: 6,
                        fontFamily: 'Tajawal, sans-serif',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {tree.description_ar}
                      </p>
                    )}

                    {/* Member Count */}
                    <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 10,
                        borderTop: '1px solid var(--color-border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          <Users size={15} />
                          <span style={{ fontFamily: 'Tajawal, sans-serif' }}>
                            {tree.member_count ?? 0} عضو
                          </span>
                        </div>

                        {/* Action Button: Opens tree if has access, else triggers request flow */}
                        {hasAccess ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleTreeAction(tree)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontFamily: 'Tajawal, sans-serif',
                              fontWeight: 700,
                              color: 'var(--color-primary)',
                            }}
                          >
                            <span>استعراض الشجرة</span>
                            <ChevronRight size={15} />
                          </button>
                        ) : isPending ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontFamily: 'Tajawal, sans-serif',
                              color: '#d97706',
                              background: '#fef3c7',
                              cursor: 'default',
                            }}
                          >
                            <Clock size={14} />
                            <span>قيد المراجعة</span>
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleTreeAction(tree)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontFamily: 'Tajawal, sans-serif',
                              fontWeight: 700,
                            }}
                          >
                            <Lock size={13} />
                            <span>طلب الوصول</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        padding: '28px 0',
        marginTop: 48,
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.875rem',
      }}>
        <div style={{ fontFamily: 'Tajawal, sans-serif', marginBottom: 4 }}>
          منصة شجرة عائلتك — استعرض شجرات عائلتك وتواصل معهم عبر الأجيال
        </div>
        <div>Family Tree Platform &copy; {new Date().getFullYear()}</div>
      </footer>

      {/* Request Access Modal */}
      {selectedTreeForRequest && (
        <RequestAccessModal
          tree={selectedTreeForRequest}
          isOpen={true}
          onClose={() => setSelectedTreeForRequest(null)}
          onRequestSubmitted={() => {
            loadTreesAndStats();
          }}
        />
      )}

      {/* Login Prompt Modal for Visitors attempting to request access */}
      {showLoginPrompt && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowLoginPrompt(false)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 440, textAlign: 'center', padding: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#dbeafe',
              color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Lock size={28} />
            </div>
            <h2 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.3rem', fontWeight: 800, marginBottom: 8 }}>
              تسجيل الدخول مطلوب
            </h2>
            <p style={{ fontFamily: 'Tajawal, sans-serif', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 20 }}>
              لتقديم طلب الوصول إلى <strong>{pendingTreeForLogin?.name_ar}</strong>، يجب عليك تسجيل الدخول بحسابك أو إنشاء حساب جديد أولاً.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowLoginPrompt(false)}
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                إلغاء
              </button>
              <Link
                to="/auth"
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Tajawal, sans-serif' }}
              >
                <LogIn size={15} />
                تسجيل الدخول
              </Link>
              <Link
                to="/auth?tab=signup"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Tajawal, sans-serif' }}
              >
                <UserPlus size={15} />
                إنشاء حساب
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
