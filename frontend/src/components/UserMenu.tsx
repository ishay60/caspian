import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { AuthModal } from './AuthModal';

export function UserMenu() {
  const { user, isLoading, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showDropdown]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className="rounded-xl px-3.5 py-2"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          width: 72,
          height: 34,
        }}
      />
    );
  }

  // Not logged in — show Sign In button
  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowAuthModal(true)}
          className="text-xs px-3.5 py-2 rounded-xl border font-medium transition-all cursor-pointer flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-neutral)',
          }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Sign in
        </button>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  // Logged in — show user avatar/name with dropdown
  const initial = (user.display_name || user.email || '?')
    .charAt(0)
    .toUpperCase();
  const displayLabel = user.display_name || user.email;
  const tierLabel = user.tier === 'pro' ? 'Pro' : 'Free';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="text-xs px-2 py-1.5 rounded-xl border font-medium transition-all cursor-pointer flex items-center gap-2"
        style={{
          backgroundColor: showDropdown
            ? 'var(--color-accent)'
            : 'var(--color-surface-2)',
          borderColor: showDropdown
            ? 'var(--color-accent)'
            : 'var(--color-border)',
          color: showDropdown ? '#fff' : 'var(--color-text)',
        }}
      >
        {/* Avatar circle */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: showDropdown
              ? 'rgba(255,255,255,0.25)'
              : 'var(--color-accent)',
            color: '#fff',
          }}
        >
          {initial}
        </span>
        <span
          className="hidden sm:inline max-w-[120px] truncate"
          style={{ fontSize: 12 }}
        >
          {displayLabel}
        </span>
        {/* Chevron */}
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          style={{
            transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-2xl border z-50 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* User info header */}
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {user.display_name || 'User'}
            </div>
            <div
              className="text-xs truncate mt-0.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {user.email}
            </div>
            {/* Tier badge */}
            <span
              className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor:
                  user.tier === 'pro'
                    ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
                    : 'var(--color-surface-2)',
                color:
                  user.tier === 'pro'
                    ? 'var(--color-accent)'
                    : 'var(--color-neutral)',
                border:
                  user.tier === 'pro'
                    ? '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)'
                    : '1px solid var(--color-border)',
              }}
            >
              {tierLabel}
            </span>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setShowDropdown(false);
                logout();
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-2"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-neutral)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  'var(--color-surface-2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  'transparent';
              }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
