import { useEffect, useRef } from 'react';

interface FormatSelectorProps {
  selectedFormat: string;
  onSelect: (format: string) => void;
  onClose: () => void;
}

const formats = [
  { value: 'auto', label: 'Auto-detect (recommended)', icon: '✨' },
  { value: 'divider', label: '', icon: '' },
  { value: 'format_a', label: 'Format A', icon: '📝' },
  { value: 'website_paste', label: 'Website Paste', icon: '📋' },
  { value: 'ug_html', label: 'Ultimate Guitar HTML', icon: '🎸' },
  { value: 'tab4u_html', label: 'Tab4u HTML', icon: '🎵' },
  { value: 'chordpro', label: 'ChordPro', icon: '📄' },
  { value: 'bar_notation', label: 'Bar Notation', icon: '|' },
];

export function FormatSelector({ selectedFormat, onSelect, onClose }: FormatSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  function handleSelect(format: string) {
    if (format !== 'divider') {
      onSelect(format);
      onClose();
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute left-0 mt-1 w-64 rounded-xl border shadow-lg z-10"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div className="py-1">
        {formats.map((format, index) => {
          if (format.value === 'divider') {
            return (
              <div
                key={index}
                className="my-1 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              />
            );
          }

          const isSelected = selectedFormat === format.value;

          return (
            <button
              key={format.value}
              type="button"
              onClick={() => handleSelect(format.value)}
              className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2"
              style={{
                color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
                backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span className="text-base">{format.icon}</span>
              <span>{format.label}</span>
              {isSelected && <span className="ml-auto">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
