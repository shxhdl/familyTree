import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, TreePine, Users } from 'lucide-react';
import type { Person } from '@/types';

export default function MemberProfilePage() {
  const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person | null>(null);
  const [father, setFather] = useState<Person | null>(null);
  const [mother, setMother] = useState<Person | null>(null);
  const [spouse, setSpouse] = useState<Person | null>(null);
  const [children, setChildren] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (personId) loadPerson();
  }, [personId]);

  const loadPerson = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('persons')
        .select('*')
        .eq('id', personId)
        .single();

      if (!data) { navigate(-1); return; }
      setPerson(data as Person);

      // Load father
      if (data.father_id) {
        const { data: fatherData } = await supabase
          .from('persons')
          .select('*')
          .eq('id', data.father_id)
          .single();
        setFather(fatherData as Person || null);
      } else {
        setFather(null);
      }

      // Load mother
      if (data.mother_id) {
        const { data: motherData } = await supabase
          .from('persons')
          .select('*')
          .eq('id', data.mother_id)
          .single();
        setMother(motherData as Person || null);
      } else {
        setMother(null);
      }

      // Load spouse
      if (data.spouse_id) {
        const { data: spouseData } = await supabase
          .from('persons')
          .select('*')
          .eq('id', data.spouse_id)
          .single();
        setSpouse(spouseData as Person || null);
      } else {
        setSpouse(null);
      }

      // Load children (either father_id or mother_id)
      const { data: childrenData } = await supabase
        .from('persons')
        .select('*')
        .or(`father_id.eq.${personId},mother_id.eq.${personId}`)
        .order('full_name_ar');
      setChildren((childrenData as Person[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <Navbar />
        <div className="loading-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!person) return null;

  const age = person.birth_year
    ? (person.is_alive ? new Date().getFullYear() - person.birth_year : (person.death_year ? person.death_year - person.birth_year : null))
    : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
        padding: '40px 0',
        color: 'white',
      }}>
        <div className="container">
          <button onClick={() => navigate(`/trees/${treeId}`)} className="btn btn-ghost btn-sm"
            style={{ color: 'rgba(255,255,255,.8)', borderColor: 'rgba(255,255,255,.3)', marginBottom: 24 }}>
            <ArrowLeft size={16} /> العودة للشجرة
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: 'rgba(255,255,255,.2)',
              border: '4px solid rgba(255,255,255,.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {person.photo_url ? (
                <img src={person.photo_url} alt={person.full_name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={52} color="rgba(255,255,255,.8)" />
              )}
            </div>

            <div>
              <h1 style={{ fontSize: '2rem', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, direction: 'rtl' }}>
                {person.full_name_ar}
              </h1>
              {person.full_name_en && <p style={{ opacity: 0.8, marginTop: 2 }}>{person.full_name_en}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: 'white', border: '1px solid rgba(255,255,255,.3)' }}>
                  {person.gender === 'male' ? '👨 ذكر' : '👩 أنثى'}
                </span>
                {person.is_alive ? (
                  <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: 'white' }}>على قيد الحياة</span>
                ) : (
                  <span className="badge" style={{ background: 'rgba(255,255,255,.15)', color: 'rgba(255,255,255,.8)' }}>متوفى</span>
                )}
                {age !== null && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: 'white' }}>
                    {person.is_alive ? `${age} سنة` : `عاش ${age} سنة`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container" style={{ padding: '40px var(--space-lg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-xl)', alignItems: 'start' }}>

          {/* Main info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Personal info */}
            <div className="card">
              <div className="card-body">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20, fontFamily: 'Tajawal, sans-serif', color: 'var(--color-primary)' }}>
                  المعلومات الشخصية
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {person.birth_year && (
                    <InfoItem icon={<Calendar size={16} />} label="سنة الميلاد" value={String(person.birth_year)} />
                  )}
                  {person.death_year && (
                    <InfoItem icon={<Calendar size={16} />} label="سنة الوفاة" value={String(person.death_year)} />
                  )}
                  {person.phone && (
                    <InfoItem icon={<Phone size={16} />} label="الهاتف" value={person.phone} />
                  )}
                  {person.email && (
                    <InfoItem icon={<Mail size={16} />} label="البريد الإلكتروني" value={person.email} />
                  )}
                  {person.location && (
                    <InfoItem icon={<MapPin size={16} />} label="الموقع" value={person.location} />
                  )}
                </div>
              </div>
            </div>

            {/* Biography */}
            {(person.bio_ar || person.bio_en) && (
              <div className="card">
                <div className="card-body">
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, fontFamily: 'Tajawal, sans-serif', color: 'var(--color-primary)' }}>
                    نبذة تعريفية
                  </h2>
                  {person.bio_ar && (
                    <p style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', lineHeight: 1.8, color: 'var(--color-text-main)', marginBottom: 12 }}>
                      {person.bio_ar}
                    </p>
                  )}
                  {person.bio_en && (
                    <p style={{ lineHeight: 1.7, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      {person.bio_en}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Children */}
            {children.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, fontFamily: 'Tajawal, sans-serif', color: 'var(--color-primary)' }}>
                    الأبناء ({children.length})
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {children.map(child => (
                      <Link
                        key={child.id}
                        to={`/trees/${treeId}/member/${child.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderRadius: 'var(--radius-md)',
                          border: '1.5px solid var(--color-border)',
                          background: 'var(--color-surface-2)',
                          color: 'var(--color-text-main)',
                          transition: 'all 0.2s',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: child.gender === 'male' ? '#dbeafe' : '#fce7f3',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem',
                        }}>
                          {child.gender === 'male' ? '👨' : '👩'}
                        </div>
                        <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>
                          {child.full_name_ar}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {/* Father */}
            {father && (
              <div className="card">
                <div className="card-body">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 12, fontFamily: 'Tajawal, sans-serif' }}>
                    الوالد
                  </h3>
                  <Link
                    to={`/trees/${treeId}/member/${father.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0,
                    }}>
                      {father.photo_url ? (
                        <img src={father.photo_url} alt={father.full_name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>👨</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {father.full_name_ar}
                      </div>
                      {father.full_name_en && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{father.full_name_en}</div>}
                    </div>
                  </Link>
                </div>
              </div>
            )}

            {/* Mother */}
            {mother && (
              <div className="card">
                <div className="card-body">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 12, fontFamily: 'Tajawal, sans-serif' }}>
                    الوالدة
                  </h3>
                  <Link
                    to={`/trees/${treeId}/member/${mother.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0,
                    }}>
                      {mother.photo_url ? (
                        <img src={mother.photo_url} alt={mother.full_name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>👩</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {mother.full_name_ar}
                      </div>
                      {mother.full_name_en && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{mother.full_name_en}</div>}
                    </div>
                  </Link>
                </div>
              </div>
            )}

            {/* Spouse */}
            {spouse && (
              <div className="card">
                <div className="card-body">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 12, fontFamily: 'Tajawal, sans-serif' }}>
                    {spouse.gender === 'male' ? 'الزوج' : 'الزوجة'}
                  </h3>
                  <Link
                    to={`/trees/${treeId}/member/${spouse.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: spouse.gender === 'male' ? '#dbeafe' : '#fce7f3',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0,
                    }}>
                      {spouse.photo_url ? (
                        <img src={spouse.photo_url} alt={spouse.full_name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>{spouse.gender === 'male' ? '👨' : '👩'}</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {spouse.full_name_ar}
                      </div>
                      {spouse.full_name_en && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{spouse.full_name_en}</div>}
                    </div>
                  </Link>
                </div>
              </div>
            )}

            {/* Quick stats */}
            <div className="card">
              <div className="card-body">
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 14, fontFamily: 'Tajawal, sans-serif' }}>
                  إحصائيات
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontFamily: 'Tajawal, sans-serif' }}>عدد الأبناء</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{children.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontFamily: 'Tajawal, sans-serif' }}>الجنس</span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{person.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
                  </div>
                  {person.birth_year && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontFamily: 'Tajawal, sans-serif' }}>العمر</span>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {age !== null ? `${age} سنة` : '—'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <Link to={`/trees/${treeId}`} className="btn btn-secondary" style={{ justifyContent: 'center' }}>
              <TreePine size={16} />
              <span style={{ fontFamily: 'Tajawal, sans-serif' }}>عرض الشجرة كاملة</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
        {icon}
        <span style={{ fontFamily: 'Tajawal, sans-serif' }}>{label}</span>
      </div>
      <span style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.95rem' }}>{value}</span>
    </div>
  );
}
