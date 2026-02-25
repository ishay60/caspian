import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../lib/authContext';
import { scanSheet } from '../api';
import type { ScanResult } from '../api';

export interface SheetUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (inputText: string) => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function SheetUpload({ isOpen, onClose, onScanComplete }: SheetUploadProps) {
  const { user } = useAuth();
  const isPro = user?.tier === 'pro';

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setPreview(null);
      setApiKey('');
      setScanning(false);
      setError(null);
      setResult(null);
      setDragOver(false);
    }
  }, [isOpen]);

  // Close on ESC
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

  // Generate preview URL for selected file
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileSelect(selectedFile: File | null) {
    setError(null);
    setResult(null);
    if (!selectedFile) return;
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Please select an image file (JPEG, PNG, GIF, or WebP).');
      return;
    }
    setFile(selectedFile);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleScan() {
    if (!file) return;
    if (!isPro && !apiKey.trim()) {
      setError('Please enter your Anthropic API key or upgrade to Pro.');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const scanResult = await scanSheet(file, isPro ? undefined : apiKey.trim());
      setResult(scanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  function handleUseResult() {
    if (result) {
      onScanComplete(result.input_text);
      onClose();
    }
  }

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface-2)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 600,
    color: 'var(--color-neutral)',
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
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
              Scan Sheet Music
            </h2>
            {isPro && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '3px 8px',
                  borderRadius: 6,
                  backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                  color: 'var(--color-accent)',
                  border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
                }}
              >
                Pro
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-neutral)',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
            aria-label="Close"
          >
            &#215;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Upload / Drop Zone */}
          {!result && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 12,
                  padding: file ? '16px' : '40px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: dragOver
                    ? 'color-mix(in srgb, var(--color-accent) 6%, transparent)'
                    : 'var(--color-surface-2)',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />

                {file && preview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <img
                      src={preview}
                      alt="Sheet preview"
                      style={{
                        width: 80,
                        height: 80,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--color-border)',
                      }}
                    />
                    <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-neutral)', margin: '4px 0 0' }}>
                        {(file.size / 1024).toFixed(1)} KB — Click to change
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.5 }}>
                      {/* Camera/upload icon via SVG */}
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px' }}>
                      Drop an image here, or click to browse
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-neutral)', margin: 0 }}>
                      Supports JPEG, PNG, GIF, WebP
                    </p>
                  </>
                )}
              </div>

              {/* API Key (non-pro only) */}
              {!isPro && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>
                    Anthropic API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="rounded-xl border px-3 py-2 text-sm outline-none transition-colors"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-neutral)', margin: 0 }}>
                    Required for sheet scanning. Upgrade to Pro to skip this.
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div
                  style={{
                    fontSize: 13,
                    padding: '10px 14px',
                    borderRadius: 12,
                    backgroundColor: 'color-mix(in srgb, var(--color-diminished) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-diminished) 50%, transparent)',
                    color: 'var(--color-diminished)',
                    fontWeight: 500,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Scan button */}
              <button
                type="button"
                onClick={handleScan}
                disabled={!file || scanning}
                className="rounded-xl text-sm font-semibold transition-all cursor-pointer"
                style={{
                  padding: '12px 16px',
                  backgroundColor: scanning || !file ? 'var(--color-neutral)' : 'var(--color-accent)',
                  color: '#fff',
                  border: 'none',
                  opacity: !file ? 0.5 : scanning ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {scanning && (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {scanning ? 'Scanning...' : 'Scan Sheet'}
              </button>
            </>
          )}

          {/* Result Preview */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                Scan Results
              </h3>

              {/* Metadata pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.scan_result.title && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 8,
                      backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    Title: {result.scan_result.title}
                  </span>
                )}
                {result.scan_result.artist && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 8,
                      backgroundColor: 'color-mix(in srgb, var(--color-diatonic) 12%, transparent)',
                      color: 'var(--color-diatonic)',
                    }}
                  >
                    Artist: {result.scan_result.artist}
                  </span>
                )}
                {result.scan_result.key && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 8,
                      backgroundColor: 'color-mix(in srgb, var(--color-borrowed) 12%, transparent)',
                      color: 'var(--color-borrowed)',
                    }}
                  >
                    Key: {result.scan_result.key}
                  </span>
                )}
                {result.scan_result.time_signature && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 8,
                      backgroundColor: 'color-mix(in srgb, var(--color-secondary-dom) 12%, transparent)',
                      color: 'var(--color-secondary-dom)',
                    }}
                  >
                    Time: {result.scan_result.time_signature}
                  </span>
                )}
              </div>

              {/* Sections with chords */}
              {result.scan_result.sections && result.scan_result.sections.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={labelStyle}>Sections</label>
                  {result.scan_result.sections.map((section, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        backgroundColor: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px', color: 'var(--color-text)' }}>
                        [{section.name}]
                      </p>
                      {section.bars.map((bar, j) => (
                        <span
                          key={j}
                          style={{
                            display: 'inline-block',
                            fontSize: 12,
                            fontFamily: 'monospace',
                            padding: '2px 8px',
                            margin: '2px 4px 2px 0',
                            borderRadius: 6,
                            backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
                            color: 'var(--color-text)',
                          }}
                        >
                          | {bar.chords.join(' ')} |
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Generated input text */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Generated Input</label>
                <pre
                  style={{
                    margin: 0,
                    padding: '12px 14px',
                    borderRadius: 10,
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {result.input_text}
                </pre>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setError(null);
                  }}
                  className="rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Scan Again
                </button>
                <button
                  type="button"
                  onClick={handleUseResult}
                  className="rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-accent)',
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 35%, transparent)',
                  }}
                >
                  Use This
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
