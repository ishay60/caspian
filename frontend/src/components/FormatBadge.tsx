interface FormatBadgeProps {
  format: string;
  confidence: 'high' | 'medium' | 'low';
  isManual: boolean;
  onClick?: () => void;
}

const formatConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  format_a: { label: 'Format A', color: '#3b82f6', bgColor: '#eff6ff' },
  website_paste: { label: 'Website Paste', color: '#10b981', bgColor: '#f0fdf4' },
  ug_html: { label: 'Ultimate Guitar HTML', color: '#f97316', bgColor: '#fff7ed' },
  tab4u_html: { label: 'Tab4u HTML', color: '#a855f7', bgColor: '#faf5ff' },
  chordpro: { label: 'ChordPro', color: '#14b8a6', bgColor: '#f0fdfa' },
  bar_notation: { label: 'Bar Notation', color: '#6366f1', bgColor: '#eef2ff' },
  unknown: { label: 'Unknown', color: '#6b7280', bgColor: '#f9fafb' },
};

export function FormatBadge({ format, confidence, isManual, onClick }: FormatBadgeProps) {
  const config = formatConfig[format] || formatConfig.unknown;

  const confidenceIcon = confidence === 'high' ? '✓' : confidence === 'medium' ? '~' : '!';
  const modeIcon = isManual ? '👤' : '✨';

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border"
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        borderColor: config.color,
      }}
      aria-label={`${isManual ? 'Manually selected' : 'Auto-detected'} format: ${config.label}`}
    >
      <span className="text-sm">{modeIcon}</span>
      <span>{config.label}</span>
      <span className="opacity-60">{confidenceIcon}</span>
    </button>
  );
}
