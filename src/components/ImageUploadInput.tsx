import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Trash2, RefreshCw, UploadCloud, Link as LinkIcon, Check } from 'lucide-react';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
}

// Client-side auto compression: resizes large camera photos to lightweight, crisp banners (~100KB)
export const compressImage = (file: File, maxWidth = 1200, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = e => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compressed JPEG at 85% quality gives great visual fidelity at small file size
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
    };
    reader.onerror = () => reject(new Error('فشل فتح الملف'));
  });
};

export default function ImageUploadInput({
  value,
  onChange,
  label = 'صورة غلاف الشجرة',
  placeholder = 'https://...',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(Boolean(value && value.startsWith('http')));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const compressedDataUrl = await compressImage(file, 1200, 0.85);
      onChange(compressedDataUrl);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء معالجة الصورة');
    } finally {
      setLoading(false);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    onChange('');
    setError('');
  };

  return (
    <div className="form-group" style={{ marginBottom: 16 }}>
      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
            fontFamily: 'Tajawal, sans-serif',
            textDecoration: 'underline',
          }}
        >
          <LinkIcon size={12} />
          <span>{showUrlInput ? 'استخدام ألبوم الكاميرا' : 'أو إدخال رابط خارجي (URL)'}</span>
        </button>
      </label>

      {/* Hidden File Input configured for Camera Roll & Device Gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="camera-roll-file-input"
      />

      {error && (
        <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginBottom: 8, fontFamily: 'Tajawal, sans-serif' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Preview if image is present */}
      {value ? (
        <div style={{
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1.5px solid #bfdbfe',
          background: '#0f172a',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <img
            src={value}
            alt="معاينة الغلاف"
            style={{
              width: '100%',
              height: 140,
              objectFit: 'cover',
              display: 'block',
            }}
            onError={() => setError('تعذر تحميل الصورة من الرابط')}
          />

          {/* Action Overlay Bar */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px 12px',
            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              style={{
                background: '#ffffff',
                color: '#1e40af',
                border: 'none',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                fontFamily: 'Tajawal, sans-serif',
              }}
            >
              <Camera size={14} />
              <span>{loading ? 'جاري التحميل...' : 'تغيير الصورة من الألبوم'}</span>
            </button>

            <button
              type="button"
              onClick={handleRemoveImage}
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'Tajawal, sans-serif',
              }}
              title="حذف الصورة"
            >
              <Trash2 size={13} />
              <span>إزالة</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty State: Direct Camera Roll Upload Button / Zone */
        <div
          onClick={() => !loading && fileInputRef.current?.click()}
          style={{
            border: '2px dashed #93c5fd',
            borderRadius: 'var(--radius-lg)',
            padding: '22px 16px',
            textAlign: 'center',
            background: '#f8fafc',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#2563eb')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#93c5fd')}
        >
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {loading ? <RefreshCw className="animate-spin" size={24} /> : <Camera size={24} />}
          </div>

          <div>
            <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#1e40af' }}>
              {loading ? 'جاري معالجة الصورة...' : '📷 اختيار صورة من ألبوم الكاميرا أو جهازك'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
              اضغط هنا لاختيار أي صورة من صور الهاتف أو الكمبيوتر مباشرة
            </div>
          </div>
        </div>
      )}

      {/* Alternative URL Input (shown when toggled) */}
      {showUrlInput && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
            أو الصق رابط صورة مباشر (URL):
          </div>
          <input
            type="url"
            value={value.startsWith('data:') ? '' : value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="form-control"
            style={{ direction: 'ltr', fontSize: '0.85rem' }}
          />
        </div>
      )}
    </div>
  );
}
