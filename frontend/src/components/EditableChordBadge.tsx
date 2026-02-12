import { useState, useRef, useEffect } from 'react';

interface Props {
  symbol: string;
  onChange: (newSymbol: string) => void;
  onDelete: () => void;
}

export function EditableChordBadge({ symbol, onChange, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(symbol);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(symbol);
  }, [symbol]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== symbol) {
      onChange(trimmed);
    } else {
      setDraft(symbol);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setDraft(symbol);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="relative inline-flex items-center">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="font-mono font-semibold text-sm rounded-lg px-3 py-1.5 border outline-none w-20 text-center"
          style={{
            borderColor: 'var(--color-primary)',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text)',
          }}
        />
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
