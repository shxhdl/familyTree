import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import PersonCard from '@/components/PersonCard';
import SubmitMemberModal from '@/components/SubmitMemberModal';
import FamilyTreeChart from '@/components/FamilyTreeChart';
import EditTreeModal from '@/components/EditTreeModal';
import EditMemberModal from '@/components/EditMemberModal';
import { ArrowLeft, Users, Plus, Search, Filter, TreePine, Lock, Pencil, GitBranch, LayoutGrid, Key, Globe, Clock, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { FamilyTree, Person, GenerationRow } from '@/types';

export default function FamilyTreePage() {
  const { treeId } = useParams<{ treeId: string }>();
  const { authUser } = useAuth();
  const navigate = useNavigate();

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [generations, setGenerations] = useState<GenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'chart' | 'grid'>('chart');
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showEditTreeModal, setShowEditTreeModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [defaultParent, setDefaultParent] = useState<{ fatherId?: string; motherId?: string } | null>(null);
  const [canContribute, setCanContribute] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState('');
  const [publishError, setPublishError] = useState('');

  const handleSendPublishRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tree) return;
    setIsPublishing(true);
    setPublishError('');

    try {
      const { error: updErr } = await supabase
        .from('family_trees')
        .update({
          publish_status: 'pending_approval',
          publish_request_note: publishNote.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tree.id);

      if (updErr) throw updErr;

      setPublishSuccess('تم إرسال طلب النشر العام لمدير النظام بنجاح!');
      setTree(prev => prev ? ({ ...prev, publish_status: 'pending_approval' }) : null);
      setTimeout(() => {
        setShowPublishModal(false);
        setPublishSuccess('');
        setPublishNote('');
      }, 1500);
    } catch (err: any) {
      setPublishError(err?.message || 'حدث خطأ أثناء إرسال طلب النشر');
    } finally {
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    if (treeId) loadTree();
  }, [treeId, authUser]);

  const loadTree = async () => {
    setLoading(true);
    try {
      // Load tree info
      const { data: treeData, error: treeErr } = await supabase
        .from('family_trees')
        .select('*')
        .eq('id', treeId)
        .single();

      if (treeErr || !treeData) {
        navigate('/');
        return;
      }
      setTree(treeData as FamilyTree);

      const isTreeOwner = (treeData as any).created_by === authUser?.id;

      if (isTreeOwner) {
        try {
          const { count } = await supabase
            .from('tree_access_requests')
            .select('*', { count: 'exact', head: true })
            .eq('tree_id', treeId)
            .eq('status', 'pending');
          setPendingRequestsCount(count || 0);
        } catch {
          // ignore
        }
      }

      // Check access (admin or tree creator/owner always has full access)
      if (authUser?.is_admin || isTreeOwner) {
        setHasAccess(true);
        setCanContribute(true);
      } else {
        if (!authUser?.id) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        const { data: perm } = await supabase
          .from('family_tree_permissions')
          .select('permission_level, can_view_tree, is_suspended, can_add_members, can_edit_members, can_manage_relations, can_manage_tree')
          .eq('tree_id', treeId)
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (!perm || perm.is_suspended === true || perm.can_view_tree === false) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
        setHasAccess(true);
        const canEdit =
          perm.permission_level === 'contributor' ||
          perm.permission_level === 'admin' ||
          perm.can_add_members === true ||
          perm.can_edit_members === true ||
          perm.can_manage_tree === true;
        setCanContribute(canEdit);
      }

      // Load persons in this tree
      const { data: membersData } = await supabase
        .from('family_tree_members')
        .select(`
          person_id, is_root,
          persons (*)
        `)
        .eq('tree_id', treeId);

      const allPersons = (membersData || [])
        .map((m: any) => m.persons)
        .filter(Boolean) as Person[];

      setPersons(allPersons);
      setGenerations(buildGenerations(allPersons));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Build generation rows based on father_id chain
  const buildGenerations = (all: Person[]): GenerationRow[] => {
    if (all.length === 0) return [];

    const personMap = new Map(all.map(p => [p.id, p]));
    const generationMap = new Map<string, number>();

    const getGeneration = (personId: string, visited = new Set<string>()): number => {
      if (generationMap.has(personId)) return generationMap.get(personId)!;
      if (visited.has(personId)) return 0; // cycle guard
      visited.add(personId);

      const person = personMap.get(personId);
      if (!person) return 0;

      // Parent check (father or mother)
      const parentId = (person.father_id && personMap.has(person.father_id))
        ? person.father_id
        : (person.mother_id && personMap.has(person.mother_id))
          ? person.mother_id
          : null;

      if (parentId) {
        const parentGen = getGeneration(parentId, visited);
        const gen = parentGen + 1;
        generationMap.set(personId, gen);
        return gen;
      }

      // Spouse check (same generation)
      if (person.spouse_id && personMap.has(person.spouse_id)) {
        const spouseGen = getGeneration(person.spouse_id, visited);
        generationMap.set(personId, spouseGen);
        return spouseGen;
      }

      generationMap.set(personId, 0);
      return 0;
    };

    all.forEach(p => getGeneration(p.id));

    const maxGen = Math.max(...Array.from(generationMap.values()));
    const rows: GenerationRow[] = [];

    for (let g = 0; g <= maxGen; g++) {
      const members = all.filter(p => generationMap.get(p.id) === g);
      if (members.length > 0) {
        rows.push({ generation: g + 1, members });
      }
    }

    return rows;
  };

  const filteredGenerations = search.trim()
    ? generations.map(row => ({
        ...row,
        members: row.members.filter(p =>
          p.full_name_ar.includes(search) ||
          p.full_name_en.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(row => row.members.length > 0)
    : generations;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <Navbar />
        <div className="loading-center">
          <div className="spinner" />
          <span style={{ fontFamily: 'Tajawal, sans-serif' }}>جاري تحميل الشجرة...</span>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <Navbar />
        <div className="empty-state" style={{ marginTop: 80 }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}><Lock size={64} color="var(--color-text-light)" /></div>
          <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>ليس لديك صلاحية للوصول لهذه الشجرة</h3>
          <p style={{ fontFamily: 'Tajawal, sans-serif' }}>يرجى التواصل مع المدير للحصول على إذن الوصول</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 24 }}>
            <ArrowLeft size={16} /> العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(tree && authUser?.id && tree.created_by === authUser.id);
  const canManageMembers = Boolean(authUser?.is_admin || isOwner || canContribute);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />

      {/* Tree Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
        color: 'white',
        padding: '40px 0 32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'white\' fill-opacity=\'1\'%3E%3Cpath d=\'M20 20.5V18H0v5h5v5h10v-4.5h5zM15 18H5V8h10v10zm15 2.5V25H25v5h10V20.5zM35 18H25V8h10v10z\'/%3E%3C/g%3E%3C/svg%3E")',
        }} />
        <div className="container" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button onClick={() => navigate(isOwner ? '/my-trees' : '/')} className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,.8)', borderColor: 'rgba(255,255,255,.3)' }}>
              <ArrowLeft size={16} /> {isOwner ? 'العودة لقسم أشجاري' : 'العودة للرئيسية'}
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {isOwner && tree && tree.publish_status !== 'published' && (
                <button
                  onClick={() => {
                    if (tree.publish_status === 'pending_approval') return;
                    setShowPublishModal(true);
                  }}
                  disabled={tree.publish_status === 'pending_approval'}
                  className="btn btn-ghost btn-sm"
                  style={{
                    color: tree.publish_status === 'pending_approval' ? '#fef08a' : 'white',
                    borderColor: 'rgba(255,255,255,0.4)',
                    background: tree.publish_status === 'pending_approval' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'Tajawal, sans-serif',
                  }}
                >
                  {tree.publish_status === 'pending_approval' ? (
                    <>
                      <Clock size={15} color="#fde047" />
                      <span>طلب النشر قيد المراجعة</span>
                    </>
                  ) : (
                    <>
                      <Globe size={15} />
                      <span>طلب نشر عام للشجرة</span>
                    </>
                  )}
                </button>
              )}
              {(authUser?.is_admin || isOwner) && tree && (
                <button
                  onClick={() => setShowEditTreeModal(true)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)' }}
                >
                  <Pencil size={15} />
                  تعديل بيانات الشجرة
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{
              width: 64, height: 64, background: 'rgba(255,255,255,.2)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(255,255,255,.4)', flexShrink: 0,
            }}>
              <TreePine size={32} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '2rem', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, direction: 'rtl', margin: 0 }}>
                  {tree?.name_ar}
                </h1>
                {isOwner && (
                  <span className="badge badge-green" style={{ background: 'rgba(255,255,255,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', fontWeight: 700 }}>
                    شجرتك الخاصة (أنت المالك)
                  </span>
                )}
              </div>
              {tree?.name_en && <p style={{ opacity: 0.8, marginTop: 2 }}>{tree.name_en}</p>}
              {tree?.description_ar && (
                <p style={{ opacity: 0.75, marginTop: 8, fontFamily: 'Tajawal, sans-serif', direction: 'rtl', fontSize: '0.95rem' }}>
                  {tree.description_ar}
                </p>
              )}
              <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.85 }}>
                  <Users size={16} />
                  <span style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.9rem' }}>
                    {persons.length} عضو
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.85 }}>
                  <Filter size={16} />
                  <span style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.9rem' }}>
                    {generations.length} جيل
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls & View Switcher Bar */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '14px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--color-surface-2)', padding: 4, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setViewMode('chart')}
              className={`btn btn-sm ${viewMode === 'chart' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <GitBranch size={16} />
              <span>رسمة بيانية للشجرة (فروع الزوجات)</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <LayoutGrid size={16} />
              <span>عرض الأجيال والبطاقات</span>
            </button>
          </div>

          {/* Search */}
          <div className="search-bar" style={{ maxWidth: 300, flex: '1 1 200px' }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="ابحث عن عضو... / Search member..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="search-members"
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {(authUser?.is_admin || isOwner) && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setEditingPerson(null); setDefaultParent(null); setShowAddMemberModal(true); }}
              >
                <Plus size={16} />
                إضافة فرد للشجرة
              </button>
            )}
            {isOwner && (
              <Link
                to={`/my-trees?tab=requests&treeId=${treeId}`}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}
                title="إدارة طلبات وتصاريح الدخول لهذه الشجرة"
              >
                <Key size={15} />
                <span>تصاريح الشجرة</span>
                {pendingRequestsCount > 0 && (
                  <span style={{
                    background: '#f59e0b',
                    color: '#ffffff',
                    fontSize: '0.70rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    lineHeight: 1.2,
                  }}>
                    {pendingRequestsCount} جديد
                  </span>
                )}
              </Link>
            )}
            {canContribute && !authUser?.is_admin && !isOwner && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowSubmitModal(true)}>
                <Plus size={16} />
                اقتراح إضافة عضو
              </button>
            )}
            {authUser?.is_admin && (
              <Link to={`/admin/members?treeId=${treeId}`} className="btn btn-secondary btn-sm">
                إدارة الأعضاء
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container" style={{ padding: '32px var(--space-lg)' }}>
        {persons.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👨‍👩‍👧‍👦</div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>لا يوجد أعضاء في هذه الشجرة بعد</h3>
            <p style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {(authUser?.is_admin || isOwner)
                ? 'ابدأ بإضافة الجد أو رب الأسرة (الأب المؤسس) للشجرة عبر الضغط على الزر أدناه'
                : 'يمكنك اقتراح إضافة عضو وسيراجعه مسؤول الشجرة'}
            </p>
            {(authUser?.is_admin || isOwner) && (
              <button
                onClick={() => { setEditingPerson(null); setDefaultParent(null); setShowAddMemberModal(true); }}
                className="btn btn-primary"
                style={{ marginTop: 20 }}
              >
                <Plus size={16} /> إضافة أول فرد للشجرة
              </button>
            )}
          </div>
        ) : viewMode === 'chart' ? (
          <FamilyTreeChart
            treeId={treeId!}
            persons={search.trim() ? persons.filter(p => p.full_name_ar.includes(search)) : persons}
            isAdmin={Boolean(authUser?.is_admin || isOwner)}
            onEditMember={person => { setEditingPerson(person); setDefaultParent(null); setShowAddMemberModal(true); }}
            onAddChild={parent => {
              setEditingPerson(null);
              if (parent.id === 'direct') {
                const root = persons.find(p => p.gender === 'male' && !p.father_id && !p.mother_id) || persons[0];
                setDefaultParent(root ? { fatherId: root.id } : null);
              } else {
                setDefaultParent(parent.gender === 'male' ? { fatherId: parent.id } : { motherId: parent.id });
              }
              setShowAddMemberModal(true);
            }}
          />
        ) : filteredGenerations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>لا توجد نتائج مطابقة</h3>
          </div>
        ) : (
          <div className="animate-fadeIn">
            {filteredGenerations.map(row => (
              <div key={row.generation} className="generation-section">
                <div className="generation-label">
                  <div className="gen-number">{row.generation}</div>
                  <h3 style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    الجيل {row.generation === 1 ? 'الأول' : row.generation === 2 ? 'الثاني' : row.generation === 3 ? 'الثالث' : `${row.generation}`}
                  </h3>
                  <span className="gen-count" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    ({row.members.length} {row.members.length === 1 ? 'عضو' : 'أعضاء'})
                  </span>
                </div>
                <div className="generation-cards">
                  {row.members.map(person => (
                    <div key={person.id} style={{ position: 'relative' }}>
                      <PersonCard
                        person={person}
                        treeId={treeId!}
                        onClick={() => navigate(`/trees/${treeId}/member/${person.id}`)}
                      />
                      {authUser?.is_admin && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingPerson(person);
                            setShowAddMemberModal(true);
                          }}
                          className="btn-icon"
                          style={{
                            position: 'absolute', top: 6, left: 6,
                            background: 'white', boxShadow: 'var(--shadow-sm)',
                            border: '1px solid var(--color-border)',
                            width: 26, height: 26,
                          }}
                          title="تعديل الفرد"
                        >
                          <Pencil size={12} color="var(--color-primary)" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Tree Modal */}
      {showEditTreeModal && tree && (
        <EditTreeModal
          tree={tree}
          onClose={() => setShowEditTreeModal(false)}
          onSaved={updated => { setTree(updated); }}
        />
      )}

      {/* Add / Edit Member Modal */}
      {showAddMemberModal && treeId && (
        <EditMemberModal
          treeId={treeId}
          person={editingPerson}
          allPersons={persons}
          defaultFatherId={defaultParent?.fatherId}
          defaultMotherId={defaultParent?.motherId}
          onClose={() => { setShowAddMemberModal(false); setEditingPerson(null); setDefaultParent(null); }}
          onSaved={() => { loadTree(); }}
        />
      )}

      {/* Suggest Member Modal */}
      {showSubmitModal && treeId && (
        <SubmitMemberModal
          treeId={treeId}
          persons={persons}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={() => { setShowSubmitModal(false); }}
        />
      )}

      {/* Publish Tree Modal */}
      {showPublishModal && tree && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPublishModal(false)}>
          <div className="modal animate-slideUp" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Tajawal, sans-serif', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.2rem', fontWeight: 800 }}>
                <Globe size={20} color="var(--color-primary)" />
                <span>طلب نشر الشجرة في المنصة العامة</span>
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPublishModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendPublishRequest}>
              <div className="modal-body">
                {publishError && (
                  <div className="alert alert-error" style={{ marginBottom: 14 }}>
                    <AlertCircle size={16} /> {publishError}
                  </div>
                )}
                {publishSuccess && (
                  <div className="alert alert-success" style={{ marginBottom: 14 }}>
                    <CheckCircle size={16} /> {publishSuccess}
                  </div>
                )}

                <p style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--color-text-main)', margin: '0 0 14px' }}>
                  سيتم إرسال طلب اعتماد نشر شجرة: <strong>{tree.name_ar}</strong> إلى مدير المنصة.
                  عند الموافقة، ستظهر بطاقة الشجرة لجميع الأعضاء والزوار في الصفحة الرئيسية.
                </p>

                <div className="form-group">
                  <label className="form-label" htmlFor="publish-note-page">
                    ملاحظة لمدير المنصة (اختياري)
                  </label>
                  <textarea
                    id="publish-note-page"
                    className="form-textarea"
                    value={publishNote}
                    onChange={e => setPublishNote(e.target.value)}
                    placeholder="مثال: تم الانتهاء من إدخال الأجيال الأساسية وتوثيقها ونرغب بنشرها في المنصة..."
                    rows={3}
                    style={{ fontFamily: 'Tajawal, sans-serif' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPublishModal(false)} disabled={isPublishing}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPublishing}>
                  <Globe size={16} />
                  {isPublishing ? 'جاري الإرسال...' : 'إرسال طلب النشر لمدير النظام'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
