import { useRef, useEffect, useState } from 'react';
import type { ChordAnalysis, Key } from '../types';
import { getChordColor } from '../lib/chordColor';
import { pitchToNoteName } from '../lib/musicTheory';

interface Props {
  chords: ChordAnalysis[];
  keyInfo: Key;
  selectedIndex: number | null;
  onSelect: (i: number) => void;
}

/* ── layout types ─────────────────────────────────────── */

interface RowInfo {
  start: number;
  count: number;
  colW: number;
  noteStartX: number;
  rowTop: number;
}

interface Ly {
  rows: RowInfo[];
  totalH: number;
}

/* ── constants ────────────────────────────────────────── */

const LABEL_H = 38;   // chord-name + roman numeral above each stave row
const SVG_H   = 100;  // VexFlow stave height per row
const STAVE_Y = 14;   // y-offset of the 5-line stave inside the SVG
const ROW_GAP = 10;   // vertical breathing room between rows
const COL_MIN = 110;  // minimum px per chord column (prevents cramming)

/**
 * Multi-row staff notation using VexFlow.
 *
 * Wraps chords into rows like sheet music — no horizontal scrolling.
 * Chord labels render as HTML above each stave row so they never overlap
 * the music glyphs.
 */
export function StaffNotation({ chords, keyInfo, selectedIndex, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const vfRef   = useRef<HTMLDivElement>(null);
  const [ly, setLy] = useState<Ly | null>(null);

  useEffect(() => {
    let dead = false;

    (async () => {
      const wrap = wrapRef.current;
      const vf   = vfRef.current;
      if (!wrap || !vf || chords.length === 0) { setLy(null); return; }

      const VF = await import('vexflow');
      if (dead) return;

      vf.innerHTML = '';

      const W = wrap.clientWidth || 800;
      const perRow = Math.max(3, Math.floor(W / COL_MIN));

      // Chunk chords into rows
      const chunks: [number, number][] = [];
      for (let i = 0; i < chords.length; i += perRow)
        chunks.push([i, Math.min(i + perRow, chords.length)]);

      const staffClr = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-staff-line').trim() || '#5c5548';

      const isMinor = keyInfo.mode.includes('minor')
        || keyInfo.mode === 'dorian' || keyInfo.mode === 'phrygian';
      const keySig = keyInfo.root_name + (isMinor ? 'm' : '');

      const rows: RowInfo[] = [];

      for (let r = 0; r < chunks.length; r++) {
        const [s, e] = chunks[r];
        const rc     = chords.slice(s, e);
        const first  = r === 0;
        const rowTop = r * (LABEL_H + SVG_H + ROW_GAP);

        /* ── row SVG container ──────────── */
        const box = document.createElement('div');
        box.style.cssText =
          `position:absolute;left:0;top:${rowTop + LABEL_H}px;width:${W}px`;
        vf.appendChild(box);

        const renderer = new VF.Renderer(box, VF.Renderer.Backends.SVG);
        renderer.resize(W, SVG_H);
        const ctx = renderer.getContext();

        /* ── stave ──────────────────────── */
        const stave = new VF.Stave(0, STAVE_Y, W);
        if (first) {
          stave.addClef('treble');
          try { stave.addKeySignature(keySig); } catch { /* unknown key */ }
        }
        stave.setContext(ctx).draw();

        /* ── recolor staff lines & glyphs ─ */
        const svg = box.querySelector('svg');
        if (svg) {
          svg.setAttribute('aria-hidden', 'true');
          svg.querySelectorAll('path,line,rect,text').forEach(el => {
            const sk = el.getAttribute('stroke');
            const fl = el.getAttribute('fill');
            if (sk === '#000000' || sk === 'black') {
              el.setAttribute('stroke', staffClr);
              el.setAttribute('stroke-width', '1.2');
            }
            if (fl === '#000000' || fl === 'black')
              el.setAttribute('fill', staffClr);
          });
        }

        /* ── notes ──────────────────────── */
        const nsX   = stave.getNoteStartX();
        const noteW = stave.getWidth() - (nsX - stave.getX());
        const colW  = noteW / rc.length;

        const notes: InstanceType<typeof VF.StaveNote>[] = [];
        for (const c of rc) {
          const color = getChordColor(c);
          const keys  = getVexFlowKeys(c.pitches, c.bass);
          if (keys.length === 0) {
            notes.push(new VF.StaveNote({ keys: ['b/4'], duration: 'wr' }));
            continue;
          }
          const n = new VF.StaveNote({ keys, duration: 'w' });
          for (let k = 0; k < keys.length; k++)
            n.setKeyStyle(k, { fillStyle: color, strokeStyle: color });
          n.setStemStyle({ strokeStyle: 'transparent' });
          notes.push(n);
        }

        if (notes.length) {
          const voice = new VF.Voice({
            numBeats: rc.length * 4, beatValue: 4,
          }).setStrict(false);
          voice.addTickables(notes);
          new VF.Formatter().joinVoices([voice]).format([voice], noteW);
          voice.draw(ctx, stave);

          // Promote notehead fill attrs → inline style (beats the CSS override)
          svg?.querySelectorAll('.vf-stavenote .vf-notehead text').forEach(el => {
            const f = (el as SVGElement).getAttribute('fill');
            if (f && f !== 'none' && f !== 'transparent')
              (el as SVGElement).style.fill = f;
          });
        }

        /* ── selected-chord column highlight ── */
        if (svg && selectedIndex !== null) {
          const li = selectedIndex - s;
          if (li >= 0 && li < rc.length) {
            const hl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hl.setAttribute('x',  String(nsX + li * colW));
            hl.setAttribute('y',  '0');
            hl.setAttribute('width',  String(colW));
            hl.setAttribute('height', String(SVG_H));
            hl.setAttribute('rx', '6');
            hl.setAttribute('fill', getChordColor(rc[li]));
            hl.setAttribute('opacity', '0.09');
            hl.setAttribute('pointer-events', 'none');
            svg.insertBefore(hl, svg.firstChild);
          }
        }

        /* ── hide VexFlow time-sig digits ── */
        svg?.querySelectorAll('text').forEach(el => {
          if (/^\d$/.test((el.textContent || '').trim()))
            el.setAttribute('visibility', 'hidden');
        });

        rows.push({ start: s, count: rc.length, colW, noteStartX: nsX, rowTop });
      }

      if (!dead) setLy({
        rows,
        totalH: chunks.length * (LABEL_H + SVG_H + ROW_GAP),
      });
    })();

    return () => { dead = true; };
  }, [chords, keyInfo, selectedIndex]);

  const n = chords.length;

  return (
    <div
      ref={wrapRef}
      className="staff-container relative rounded-xl"
      role="region"
      aria-label={
        n > 0
          ? `Staff notation: ${n} chord${n !== 1 ? 's' : ''}`
          : undefined
      }
      style={ly ? { height: ly.totalH, minHeight: 100 } : { minHeight: 100 }}
    >
      {/* VexFlow SVGs (imperative) */}
      <div ref={vfRef} className="absolute inset-0" />

      {/* React-managed labels & interactive hit-areas */}
      {ly?.rows.map((row, ri) => {
        const items: {
          gi: number;
          chord: ChordAnalysis;
          color: string;
          sel: boolean;
          lx: number;
        }[] = [];

        for (let i = 0; i < row.count; i++) {
          const gi = row.start + i;
          const chord = chords[gi];
          if (!chord) continue;
          items.push({
            gi,
            chord,
            color: getChordColor(chord),
            sel: selectedIndex === gi,
            lx: row.noteStartX + i * row.colW,
          });
        }

        return (
          <div key={ri}>
            {/* ── chord labels above this row ── */}
            {items.map(({ gi, chord, color, sel, lx }) => (
              <div
                key={`l${gi}`}
                className="absolute flex flex-col items-center justify-end
                           pointer-events-none select-none"
                style={{
                  left: lx,
                  width: row.colW,
                  top: row.rowTop,
                  height: LABEL_H,
                  paddingBottom: 2,
                }}
              >
                <span
                  className="text-[12px] font-bold leading-none truncate max-w-full"
                  style={{
                    color,
                    opacity: sel ? 1 : 0.8,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {chord.symbol}
                </span>
                <span
                  className="text-[10px] font-semibold leading-none mt-1
                             truncate max-w-full"
                  style={{ color: 'var(--color-neutral)' }}
                >
                  {chord.roman_numeral}
                </span>
              </div>
            ))}

            {/* ── clickable / focusable hit-areas ── */}
            {items.map(({ gi, chord, sel, lx }) => (
              <button
                key={`b${gi}`}
                type="button"
                className="absolute cursor-pointer bg-transparent border-0
                           rounded-lg focus:outline-none focus-visible:ring-2
                           focus-visible:ring-[var(--color-accent)]
                           focus-visible:ring-inset pointer-events-auto"
                style={{
                  left: lx,
                  width: row.colW,
                  top: row.rowTop,
                  height: LABEL_H + SVG_H,
                }}
                onClick={() => onSelect(gi)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(gi);
                  }
                  if (e.key === 'ArrowLeft' && gi > 0) {
                    e.preventDefault();
                    (document.querySelector(
                      `[data-staff-chord="${gi - 1}"]`,
                    ) as HTMLElement)?.focus();
                  }
                  if (e.key === 'ArrowRight' && gi < n - 1) {
                    e.preventDefault();
                    (document.querySelector(
                      `[data-staff-chord="${gi + 1}"]`,
                    ) as HTMLElement)?.focus();
                  }
                }}
                aria-label={`${chord.symbol}, ${chord.roman_numeral}${
                  sel ? ' (selected)' : ''
                }`}
                aria-pressed={sel}
                data-staff-chord={gi}
                tabIndex={0}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────── */

function getVexFlowKeys(pitches: number[], bass: number): string[] {
  if (pitches.length === 0) return [];

  const bassPc = ((bass % 12) + 12) % 12;
  const sorted = [...pitches].sort((a, b) => a - b);

  // Closed voicing: bass in octave 4, other notes placed at the closest
  // pitch-class occurrence above the bass.  This keeps the entire chord
  // compact and within the treble-clef staff (E4-F5) with at most 1-2
  // ledger lines.  MIDI 60 = C4, so bass midi = 60 + bassPc.
  const bassName = pitchToNoteName(bassPc).toLowerCase();
  const bassMidi = 60 + bassPc;
  const keys: { key: string; midi: number }[] = [
    { key: `${bassName}/4`, midi: bassMidi },
  ];

  const remaining = sorted.filter(p => ((p % 12) + 12) % 12 !== bassPc);

  for (const p of remaining) {
    const pc = ((p % 12) + 12) % 12;
    // Closest occurrence of this pitch class above the bass
    let midi = 60 + pc;
    while (midi <= bassMidi) midi += 12;
    const octave = Math.floor(midi / 12) - 1;
    const name = pitchToNoteName(pc).toLowerCase();
    keys.push({ key: `${name}/${octave}`, midi });
  }

  keys.sort((a, b) => a.midi - b.midi);
  return keys.map(k => k.key);
}
