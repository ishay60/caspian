/**
 * BarSuggestionPanel Component
 *
 * Displays automatically detected bar suggestions with confidence scores.
 * Allows users to accept, reject, or review individual suggestions.
 *
 * FEATURES:
 * - Visual preview of suggested bar divisions
 * - Confidence indicator (high/medium/low)
 * - Bulk actions (Accept All, Reject All)
 * - Individual review with edit capability
 * - Integration with BarOverlay component
 *
 * WORKFLOW:
 * 1. Backend detects bar boundaries using heuristics
 * 2. Component displays suggestions sorted by confidence
 * 3. User can accept all, reject all, or review individually
 * 4. Accepted suggestions are passed to BarOverlay for fine-tuning
 * 5. Rejected suggestions are ignored
 *
 * CONFIDENCE LEVELS:
 * - High (0.8-1.0): Green badge, auto-apply recommended
 * - Medium (0.5-0.8): Yellow badge, user confirmation needed
 * - Low (<0.5): Red badge, not shown by default
 */

import { useState } from 'react';
import './BarSuggestionPanel.css';

/**
 * BarSuggestion from backend API
 */
export interface BarSuggestion {
  position: number; // Index in chord sequence
  confidence: number; // 0.0-1.0
  reason: string; // Human-readable explanation
  heuristic: string; // Which heuristic generated this
}

/**
 * BarSuggestionPanelProps
 */
interface BarSuggestionPanelProps {
  // Input
  suggestions: BarSuggestion[];
  chordSequence: string[]; // For preview visualization

  // Callbacks
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onAcceptSuggestions?: (positions: number[]) => void;
  onReview?: () => void;
  onClose?: () => void;

  // Options
  autoApplyHighConfidence?: boolean; // Auto-apply suggestions with confidence >= 0.8
  showLowConfidence?: boolean; // Show suggestions with confidence < 0.5
}

/**
 * Get confidence level label and color
 */
function getConfidenceLevel(confidence: number): {
  level: 'high' | 'medium' | 'low';
  color: string;
  label: string;
} {
  if (confidence >= 0.8) {
    return { level: 'high', color: '#4ade80', label: 'High Confidence' };
  } else if (confidence >= 0.5) {
    return { level: 'medium', color: '#fbbf24', label: 'Medium Confidence' };
  } else {
    return { level: 'low', color: '#f87171', label: 'Low Confidence' };
  }
}

/**
 * BarSuggestionPanel Component
 */
export function BarSuggestionPanel({
  suggestions,
  chordSequence,
  onAcceptAll,
  onRejectAll,
  onAcceptSuggestions,
  onReview,
  onClose,
  autoApplyHighConfidence = false,
  showLowConfidence = false,
}: BarSuggestionPanelProps) {
  // Filter suggestions by confidence
  const filteredSuggestions = showLowConfidence
    ? suggestions
    : suggestions.filter((s) => s.confidence >= 0.5);

  // Group suggestions by confidence level
  const highConfidence = filteredSuggestions.filter((s) => s.confidence >= 0.8);
  const mediumConfidence = filteredSuggestions.filter(
    (s) => s.confidence >= 0.5 && s.confidence < 0.8
  );
  const lowConfidence = filteredSuggestions.filter((s) => s.confidence < 0.5);

  // State for selected suggestions
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(
    new Set(filteredSuggestions.map((s) => s.position))
  );

  /**
   * Toggle selection of a suggestion
   */
  const toggleSelection = (position: number) => {
    const newSelected = new Set(selectedPositions);
    if (newSelected.has(position)) {
      newSelected.delete(position);
    } else {
      newSelected.add(position);
    }
    setSelectedPositions(newSelected);
  };

  /**
   * Handle Accept All
   */
  const handleAcceptAll = () => {
    if (onAcceptAll) {
      onAcceptAll();
    } else if (onAcceptSuggestions) {
      onAcceptSuggestions(filteredSuggestions.map((s) => s.position));
    }
  };

  /**
   * Handle Reject All
   */
  const handleRejectAll = () => {
    if (onRejectAll) {
      onRejectAll();
    } else if (onClose) {
      onClose();
    }
  };

  /**
   * Handle Accept Selected
   */
  const handleAcceptSelected = () => {
    if (onAcceptSuggestions) {
      onAcceptSuggestions(Array.from(selectedPositions));
    }
  };

  /**
   * Render preview of bar divisions
   */
  const renderPreview = () => {
    if (!chordSequence.length) return null;

    const positions = Array.from(selectedPositions).sort((a, b) => a - b);
    const bars: string[][] = [];
    let currentBar: string[] = [];
    let positionIndex = 0;

    chordSequence.forEach((chord, i) => {
      currentBar.push(chord);

      // Check if there's a bar boundary after this chord
      if (positionIndex < positions.length && i + 1 === positions[positionIndex]) {
        bars.push([...currentBar]);
        currentBar = [];
        positionIndex++;
      }
    });

    // Add remaining chords
    if (currentBar.length > 0) {
      bars.push(currentBar);
    }

    return (
      <div className="bar-preview">
        <h4>Preview</h4>
        <div className="bar-preview-sequence">
          {bars.map((bar, i) => (
            <div key={i} className="bar-preview-bar">
              <span className="bar-line">|</span>
              {bar.map((chord, j) => (
                <span key={j} className="bar-preview-chord">
                  {chord}
                </span>
              ))}
            </div>
          ))}
          <span className="bar-line">|</span>
        </div>
      </div>
    );
  };

  /**
   * Render suggestion item
   */
  const renderSuggestion = (suggestion: BarSuggestion) => {
    const { level, color, label } = getConfidenceLevel(suggestion.confidence);
    const isSelected = selectedPositions.has(suggestion.position);

    return (
      <div
        key={suggestion.position}
        className={`suggestion-item ${level} ${isSelected ? 'selected' : ''}`}
        onClick={() => toggleSelection(suggestion.position)}
      >
        <div className="suggestion-header">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelection(suggestion.position)}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="suggestion-position">Position {suggestion.position}</span>
          <span className="confidence-badge" style={{ backgroundColor: color }}>
            {label} ({(suggestion.confidence * 100).toFixed(0)}%)
          </span>
        </div>
        <div className="suggestion-reason">{suggestion.reason}</div>
        <div className="suggestion-heuristic">Source: {suggestion.heuristic}</div>
      </div>
    );
  };

  return (
    <div className="bar-suggestion-panel">
      <div className="panel-header">
        <h3>Bar Division Suggestions</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="panel-summary">
        <p>
          {filteredSuggestions.length} suggestion{filteredSuggestions.length !== 1 ? 's' : ''}{' '}
          detected
        </p>
        {highConfidence.length > 0 && (
          <p className="confidence-summary high">
            {highConfidence.length} high confidence
          </p>
        )}
        {mediumConfidence.length > 0 && (
          <p className="confidence-summary medium">
            {mediumConfidence.length} medium confidence
          </p>
        )}
        {autoApplyHighConfidence && highConfidence.length > 0 && (
          <p className="auto-apply-notice">
            High confidence suggestions will be auto-applied
          </p>
        )}
      </div>

      {renderPreview()}

      <div className="suggestions-list">
        <h4>Suggestions</h4>
        {highConfidence.length > 0 && (
          <div className="confidence-group">
            <h5>High Confidence</h5>
            {highConfidence.map(renderSuggestion)}
          </div>
        )}
        {mediumConfidence.length > 0 && (
          <div className="confidence-group">
            <h5>Medium Confidence</h5>
            {mediumConfidence.map(renderSuggestion)}
          </div>
        )}
        {showLowConfidence && lowConfidence.length > 0 && (
          <div className="confidence-group">
            <h5>Low Confidence</h5>
            {lowConfidence.map(renderSuggestion)}
          </div>
        )}
      </div>

      <div className="panel-actions">
        <button className="btn btn-success" onClick={handleAcceptAll}>
          Accept All
        </button>
        <button className="btn btn-primary" onClick={handleAcceptSelected}>
          Accept Selected ({selectedPositions.size})
        </button>
        {onReview && (
          <button className="btn btn-secondary" onClick={onReview}>
            Review Manually
          </button>
        )}
        <button className="btn btn-danger" onClick={handleRejectAll}>
          Reject All
        </button>
      </div>
    </div>
  );
}
