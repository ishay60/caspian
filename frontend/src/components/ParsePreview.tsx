import type { FormatPreview } from '../types';

interface ParsePreviewProps {
  preview: FormatPreview | null;
  isLoading: boolean;
  error?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ParsePreview({ preview, isLoading, error, isExpanded, onToggle }: ParsePreviewProps) {
  if (!preview && !isLoading && !error) {
    return null;
  }

  return (
    <div
      className="mt-3 rounded-xl border overflow-hidden"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-2)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Preview
        </span>
        {!isExpanded && preview && preview.sections.length > 0 && (
          <span className="text-xs opacity-60">
            {preview.sections.length} section{preview.sections.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {isExpanded && (
        <div
          className="px-4 pb-4 border-t text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {isLoading && (
            <div className="py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Detecting format...
              </div>
            </div>
          )}

          {error && (
            <div
              className="mt-3 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: 'color-mix(in srgb, #ef4444 10%, transparent)',
                color: '#ef4444',
              }}
            >
              <div className="font-medium mb-1">Parse Error</div>
              <div className="text-xs opacity-90">{error}</div>
              <div className="text-xs opacity-70 mt-2">
                Try selecting a different format manually.
              </div>
            </div>
          )}

          {preview && !isLoading && (
            <div className="mt-3 space-y-3">
              {/* Metadata */}
              {(preview.key || preview.title || preview.artist) && (
                <div
                  className="p-3 rounded-lg space-y-1"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  {preview.key && (
                    <div className="text-xs">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Key: </span>
                      <span style={{ color: 'var(--color-text)' }} className="font-medium">
                        {preview.key}
                      </span>
                    </div>
                  )}
                  {preview.title && (
                    <div className="text-xs">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Title: </span>
                      <span style={{ color: 'var(--color-text)' }}>{preview.title}</span>
                    </div>
                  )}
                  {preview.artist && (
                    <div className="text-xs">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Artist: </span>
                      <span style={{ color: 'var(--color-text)' }}>{preview.artist}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Sections */}
              {preview.sections.length > 0 && (
                <div>
                  <div
                    className="text-xs font-medium mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Sections ({preview.sections.length}):
                  </div>
                  <div className="space-y-2">
                    {preview.sections.map((section, index) => (
                      <div
                        key={index}
                        className="p-2.5 rounded-lg"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-xs font-medium"
                            style={{ color: 'var(--color-accent)' }}
                          >
                            [{section.name}]
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {section.chord_count} chord{section.chord_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {section.first_chords.length > 0 && (
                          <div className="text-xs font-mono" style={{ color: 'var(--color-text)' }}>
                            {section.first_chords.join(' · ')}
                            {section.chord_count > section.first_chords.length && (
                              <span style={{ color: 'var(--color-text-secondary)' }}> ...</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.sections.length === 0 && (
                <div
                  className="text-xs text-center py-3"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  No sections detected
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
