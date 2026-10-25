import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { TreePine, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />
      <div className="empty-state" style={{ marginTop: 80 }}>
        <div style={{ fontSize: '6rem', marginBottom: 16 }}>🔍</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 8 }}>404</h1>
        <h3 style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '1.3rem' }}>الصفحة غير موجودة</h3>
        <p style={{ fontFamily: 'Tajawal, sans-serif' }}>الصفحة التي تبحث عنها غير موجودة أو تم نقلها</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Link to="/" className="btn btn-primary">
            <Home size={16} /> العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
