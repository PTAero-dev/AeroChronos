import React, { useState } from 'react';
import { signInWithGoogle } from '../firebase/auth';

const LoginScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch {
      setError('Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
    }}>
      {/* Logo / Branding */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '4px',
          background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          AEROCHRONOS
        </div>
        <div style={{
          color: '#475569',
          fontSize: '0.85rem',
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Flight Logbook & FDP Tracker
        </div>
      </div>

      {/* Login Card */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          color: '#f8fafc',
          marginBottom: '8px',
        }}>
          Welcome Back
        </div>
        <div style={{
          color: '#64748b',
          fontSize: '0.875rem',
          marginBottom: '32px',
          lineHeight: 1.5,
        }}>
          Sign in to access your logbook.<br />Your data is securely stored in the cloud.
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '14px 20px',
            background: loading ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px',
            color: '#f8fafc',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            letterSpacing: '0.5px',
          }}
          onMouseEnter={e => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
          }}
          onMouseLeave={e => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
          }}
        >
          {/* Google Logo SVG */}
          {!loading ? (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          ) : (
            <div style={{
              width: '20px', height: '20px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        {error && (
          <div style={{
            marginTop: '16px',
            color: '#ef4444',
            fontSize: '0.8rem',
            padding: '10px',
            background: 'rgba(239,68,68,0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.2)',
          }}>
            {error}
          </div>
        )}

        <div style={{
          marginTop: '24px',
          color: '#334155',
          fontSize: '0.75rem',
          lineHeight: 1.6,
        }}>
          Your logbook data is private and only accessible with your Google account.
        </div>
      </div>

      {/* Version badge */}
      <div style={{
        marginTop: '32px',
        color: '#1e293b',
        fontSize: '0.7rem',
        letterSpacing: '2px',
        textTransform: 'uppercase',
      }}>
        © AEROTHAI FLIGHT INSPECTION CENTER
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default LoginScreen;
