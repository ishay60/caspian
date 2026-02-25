import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/authContext';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, initialTab = 'login' }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset form state when modal opens/closes or tab changes
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    setError(null);
  }, [tab]);

  // Close on ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, displayName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface-2)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text)',
  };

  return (
    /* Backdrop */
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Modal card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          borderWidth: 1,
          borderStyle: 'solid',
          borderRadius: 16,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {(['login', 'signup'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '14px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: 'none',
                color:
                  tab === t ? 'var(--color-accent)' : 'var(--color-neutral)',
                borderBottom:
                  tab === t
                    ? '2px solid var(--color-accent)'
                    : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form
          onSubmit={tab === 'login' ? handleLogin : handleRegister}
          style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* Sign-up only: display name */}
          {tab === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                  color: 'var(--color-neutral)',
                }}
              >
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
                className="rounded-xl border px-3 py-2 text-sm outline-none transition-colors"
                style={inputStyle}
              />
            </div>
          )}

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 600,
                color: 'var(--color-neutral)',
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="rounded-xl border px-3 py-2 text-sm outline-none transition-colors"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 600,
                color: 'var(--color-neutral)',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              minLength={6}
              className="rounded-xl border px-3 py-2 text-sm outline-none transition-colors"
              style={inputStyle}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                fontSize: 13,
                padding: '10px 14px',
                borderRadius: 12,
                backgroundColor:
                  'color-mix(in srgb, var(--color-diminished) 12%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--color-diminished) 50%, transparent)',
                color: 'var(--color-diminished)',
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl text-sm font-semibold transition-all cursor-pointer"
            style={{
              padding: '12px 16px',
              backgroundColor: loading
                ? 'var(--color-neutral)'
                : 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? 'Please wait...'
              : tab === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>

          {/* Switch tab hint */}
          <p
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--color-neutral)',
              margin: 0,
            }}
          >
            {tab === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                    padding: 0,
                  }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                    padding: 0,
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
