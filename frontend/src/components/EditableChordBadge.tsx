import { useState, useRef, useEffect, useCallback } from 'react';
import { getChordCompletions } from '../api';

export interface ChordCompletionContext {
  keyRootName: string;
  keyMode: string;
  prevChord?: string;
  nextChord?: string;
}

interface Props {
  symbol: string;
  onChange: (newSymbol: string) => void;
  onDelete: () => void;
  completionContext?: ChordCompletionContext;
}

const COMPLETION_DEBOUNCE_MS = 180;

export function EditableChordBadge({ symbol, onChange, onDelete, completionContext }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(symbol);
  const [completions, setCompletions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(symbol);
  }, [symbol]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Debounced chord completion fetch
  useEffect(() => {
    if (!editing || !completionContext || draft.trim().length < 1) {
      setCompletions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setLoading(true);
      getChordCompletions(
        draft.trim(),
        completionContext.keyRootName,
        completionContext.keyMode,
        completionContext.prevChord,
        completionContext.nextChord,
      )
        .then((list) => {
          setCompletions(list);
          setSelectedIndex(0);
        })
        .catch(() => setCompletions([]))
        .finally(() => setLoading(false));
    }, COMPLETION_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editing, draft, completionContext]);

  const applyCompletion = useCallback(
    (chord: string) => {
      if (chord && chord !== symbol) {
        onChange(chord);
      }
      setEditing(false);
      setCompletions([]);
    },
    [onChange, symbol],
  );

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== symbol) {
      onChange(trimmed);
    } else {
      setDraft(symbol);
    }
    setEditing(false);
    setCompletions([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const showDropdown = completions.length > 0;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && selectedIndex >= 0 && selectedIndex < completions.length) {
        applyCompletion(completions[selectedIndex]);
      } else {
        commit();
      }
      return;
    }
    if (e.key === 'Escape') {
      setDraft(symbol);
      setEditing(false);
      setCompletions([]);
      return;
    }
    if (showDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (e.key === 'ArrowDown') {
        setSelectedIndex((i) => (i < completions.length - 1 ? i + 1 : 0));
      } else {
        setSelectedIndex((i) => (i > 0 ? i - 1 : completions.length - 1));
      }
      return;
    }
  }

  const canShowDropdown = editing && completionContext && draft.trim().length >= 1;
  const showDropdown = canShowDropdown;

  if (editing) {
    return (
      <div className="relative inline-flex flex-col items-stretch" style={{ overflow: 'visible' }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="font-mono font-semibold text-sm rounded-xl px-3 py-1.5 border outline-none w-20 text-center"
          style={{
            borderColor: 'var(--color-primary)',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text)',
          }}
        />
        {showDropdown && (
          <ul
            className="absolute top-full left-0 mt-1 min-w-[5rem] max-h-48 overflow-y-auto rounded-xl border shadow-lg py-1"
            style={{
              borderColor: 'var(--color-primary)',
              backgroundColor: 'var(--color-surface-2)',
              zIndex: 9999,
            }}
          >
            {loading ? (
              <li className="px-3 py-2 font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Loading…
              </li>
            ) : completions.length === 0 ? (
              <li className="px-3 py-2 font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No suggestions
              </li>
            ) : (
              completions.map((c, i) => (
                <li key={c}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyCompletion(c);
                    }}
                    className="w-full text-left font-mono text-sm px-3 py-1.5 cursor-pointer"
                    style={{
                      backgroundColor: i === selectedIndex ? 'var(--color-primary)' : 'transparent',
                      color: i === selectedIndex ? 'white' : 'var(--color-text)',
                    }}
                  >
                    {c}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center group/badge">
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg px-3 py-1.5 border cursor-pointer transition-colors"
        style={{
          borderColor: 'var(--color-primary)',
          borderStyle: 'dashed',
          backgroundColor: 'var(--color-surface-2)',
        }}
      >
        <div className="font-mono font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
          {symbol}
        </div>
      </button>
      <button
        onClick={onDelete}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-xs leading-none opacity-0 group-hover/badge:opacity-100 transition-opacity cursor-pointer"
        style={{
          backgroundColor: 'var(--color-deceptive, #e53e3e)',
          color: 'white',
        }}
        title="Remove chord"
      >
        &times;
      </button>
    </div>
  );
}
