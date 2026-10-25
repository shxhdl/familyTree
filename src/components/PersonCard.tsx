import type { Person } from '@/types';
import { User } from 'lucide-react';

interface Props {
  person: Person;
  treeId: string;
  onClick: () => void;
}

export default function PersonCard({ person, onClick }: Props) {
  const years = person.birth_year
    ? `${person.birth_year}${person.death_year ? ` — ${person.death_year}` : ''}`
    : '';

  return (
    <div
      className={`person-card ${!person.is_alive ? 'deceased' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`View profile: ${person.full_name_ar}`}
    >
      {/* Gender indicator */}
      <div className={`gender-badge ${person.gender}`}>
        {person.gender === 'male' ? '♂' : '♀'}
      </div>

      {/* Avatar */}
      <div className="person-avatar">
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.full_name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <User size={28} color="var(--color-primary)" />
        )}
      </div>

      {/* Name */}
      <div className="person-name-ar">{person.full_name_ar}</div>
      {person.full_name_en && <div className="person-name-en">{person.full_name_en}</div>}

      {/* Years */}
      {years && <div className="person-years">{years}</div>}

      {/* Deceased indicator */}
      {!person.is_alive && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          background: '#f1f5f9', borderRadius: 'var(--radius-full)',
          padding: '2px 8px', fontSize: '0.7rem', color: 'var(--color-text-light)',
          fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap',
        }}>
          رحمه الله
        </div>
      )}
    </div>
  );
}
