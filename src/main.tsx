import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl',
          fontFamily: 'Tajawal, sans-serif',
          background: '#f8fafc',
          padding: 20,
          textAlign: 'center',
        }}>
          <div style={{
            background: '#ffffff',
            padding: '32px 28px',
            borderRadius: 16,
            boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
            maxWidth: 440,
            width: '100%',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: 8, fontWeight: 800 }}>
              حدث خطأ أثناء تحميل الصفحة
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 20 }}>
              يرجى إعادة تحميل الصفحة أو التأكد من إعدادات الاتصال.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#1d4ed8',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              إعادة التحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
