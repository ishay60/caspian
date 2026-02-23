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

interface ColumnBounds {
  left: number;
  width: number;
  centerX: number;
}

interface StaffLayout {
  columns: ColumnBounds[];
  totalWidth: number;
  staffHeight: number;
  staveY: number;
}

/**
 * Renders chord noteheads on a treble clef staff using VexFlow.
 * Uses a fixed column grid so chord columns and rectangles align with the five staff lines.
 * Accessible: region label, one focusable button per chord with aria-labels, keyboard selectable.
 */
export function StaffNotation({ chords, keyInfo, selectedIndex, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<StaffLayout | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const container = containerRef.current;
      if (!container || chords.length === 0) {
        setLayout(null);
        return;
      }

      const VF = await import('vexflow');
      if (cancelled) return;

      container.innerHTML = '';

      const chordWidth = 98;
      const clefArea = 54;
      const totalWidth = Math.max(clefArea + chords.length * chordWidth, 320);
      const staveY = 56;
      const staffHeight = 220;

      const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
      renderer.resize(totalWidth, staffHeight);
      const context = renderer.getContext();
      context.setFont('DM Sans, system-ui, sans-serif', 16);

      const stave = new VF.Stave(0, staveY, totalWidth);
      stave.addClef('treble');
      const keyName = keyInfo.root_name + (keyInfo.mode === 'minor' ? 'm' : '');
      try {
        stave.addKeySignature(keyName);
      } catch {
        /* ignore */
      }
      stave.setContext(context).draw();

      const noteStartX = stave.getNoteStartX();
      const noteAreaWidth = stave.getWidth() - (noteStartX - stave.getX());
      const columnWidth = noteAreaWidth / chords.length;

      const staffColor = getComputedStyle(document.documentElement).getPropertyValue('--color-staff-line').trim() || '#6b6358';
      const svg = container.querySelector('svg');
      if (svg) {
        svg.setAttribute('aria-hidden', 'true');
        svg.style.overflow = 'visible';
        svg.querySelectorAll('path, line, rect').forEach(el => {
          const stroke = el.getAttribute('stroke');
          const fill = el.getAttribute('fill');
          if (stroke === '#000000' || stroke === 'black') {
            el.setAttribute('stroke', staffColor);
            el.setAttribute('stroke-width', '1.4');
          }
          if (fill === '#000000' || fill === 'black') el.setAttribute('fill', staffColor);
        });
      }

      const notes: InstanceType<typeof VF.StaveNote>[] = [];
      for (let i = 0; i < chords.length; i++) {
        const chord = chords[i];
        const color = getChordColor(chord);
        const keys = getVexFlowKeys(chord.pitches, chord.bass);
        if (keys.length === 0) {
          notes.push(new VF.StaveNote({ keys: ['b/4'], duration: 'wr' }));
          continue;
        }
        const note = new VF.StaveNote({ keys, duration: 'w' });
        for (let k = 0; k < keys.length; k++) {
          note.setKeyStyle(k, { fillStyle: color, strokeStyle: color });
        }
        note.setStemStyle({ strokeStyle: 'transparent' });
        notes.push(note);
      }

      const columns: ColumnBounds[] = [];

      if (notes.length > 0) {
        const voice = new VF.Voice({
          numBeats: chords.length * 4,
          beatValue: 4,
        }).setStrict(false);
        voice.addTickables(notes);
        new VF.Formatter()
          .joinVoices([voice])
          .format([voice], noteAreaWidth);
        voice.draw(context, stave);

        for (let i = 0; i < notes.length; i++) {
          const bbox = notes[i].getBoundingBox();
          if (bbox) {
            const left = bbox.getX();
            const width = Math.max(bbox.getW(), 24);
            columns.push({
              left,
              width,
              centerX: left + width / 2,
            });
          } else {
            const colLeft = noteStartX + i * columnWidth;
            columns.push({
              left: colLeft,
              width: columnWidth,
              centerX: colLeft + columnWidth / 2,
            });
          }
        }
      }

      while (columns.length < chords.length) {
        const i = columns.length;
        const colLeft = noteStartX + i * columnWidth;
        columns.push({
          left: colLeft,
          width: columnWidth,
          centerX: colLeft + columnWidth / 2,
        });
      }

      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
        || getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim()
        || '#eae6dd';

      if (svg) {
        for (let i = 0; i < chords.length; i++) {
          const chord = chords[i];
          const color = getChordColor(chord);
          const col = columns[i];
          const cx = col.centerX;

          const isSelected = selectedIndex === i;
          if (isSelected) {
            const hlRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hlRect.setAttribute('x', String(col.left));
            hlRect.setAttribute('y', String(staveY - 22));
            hlRect.setAttribute('width', String(col.width));
            hlRect.setAttribute('height', String(118));
            hlRect.setAttribute('rx', '8');
            hlRect.setAttribute('fill', color);
            hlRect.setAttribute('opacity', '0.1');
            hlRect.setAttribute('pointer-events', 'none');
            svg.appendChild(hlRect);
          }

          const highlightTop = staveY - 22;
          const labelY = highlightTop + 10;
          const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          textEl.setAttribute('x', String(cx));
          textEl.setAttribute('y', String(labelY));
          textEl.setAttribute('text-anchor', 'middle');
          textEl.setAttribute('dominant-baseline', 'hanging');

          const tspanSymbol = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspanSymbol.setAttribute('fill', color);
          tspanSymbol.setAttribute('font-family', 'JetBrains Mono, ui-monospace, monospace');
          tspanSymbol.setAttribute('font-size', '17');
          tspanSymbol.setAttribute('font-weight', '700');
          tspanSymbol.textContent = chord.symbol;

          const tspanRoman = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspanRoman.setAttribute('fill', textColor);
          tspanRoman.setAttribute('font-family', 'DM Sans, system-ui, sans-serif');
          tspanRoman.setAttribute('font-size', '14');
          tspanRoman.setAttribute('font-weight', '600');
          tspanRoman.setAttribute('dx', '4');
          tspanRoman.textContent = ` · ${chord.roman_numeral}`;

          textEl.appendChild(tspanSymbol);
          textEl.appendChild(tspanRoman);
          svg.appendChild(textEl);
        }
        svg.querySelectorAll('path[fill]').forEach(el => {
          const fill = el.getAttribute('fill');
          if (fill && fill !== 'transparent' && fill !== 'none') {
            el.setAttribute('stroke', fill);
            el.setAttribute('stroke-width', '1.4');
          }
        });
        svg.querySelectorAll('text').forEach((el) => {
          const content = (el.textContent || '').trim();
          if (content.length === 1 && /^\d$/.test(content)) {
            el.setAttribute('visibility', 'hidden');
          }
        });
      }

      if (!cancelled) {
        setLayout({
          columns,
          totalWidth,
          staffHeight,
          staveY,
        });
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chords, keyInfo, selectedIndex]);

  const n = chords.length;

  return (
    <div
      className="staff-container relative overflow-x-auto rounded-xl"
      role="region"
      aria-label={n > 0 ? `Staff notation: ${n} chord${n !== 1 ? 's' : ''}. Use Tab to move between chords, Enter or Space to select.` : undefined}
    >
      <div
        ref={containerRef}
        className="staff-svg-wrapper"
        style={layout ? { width: layout.totalWidth, height: layout.staffHeight, minHeight: 200 } : { minHeight: 200 }}
      />
      {layout && n > 0 && (
        <div
          className="absolute left-0 top-0 pointer-events-none"
          style={{
            width: layout.totalWidth,
            height: layout.staffHeight,
          }}
          aria-hidden
        >
          {chords.map((chord, i) => {
            const col = layout.columns[i];
            if (!col) return null;
            const isSelected = selectedIndex === i;
            return (
              <button
                key={i}
                type="button"
                className="absolute cursor-pointer bg-transparent border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset rounded pointer-events-auto"
                style={{
                  left: col.left,
                  top: layout.staveY - 22,
                  width: col.width,
                  height: 118,
                }}
                onClick={() => onSelect(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(i);
                  }
                  if (e.key === 'ArrowLeft' && i > 0) {
                    e.preventDefault();
                    const prev = document.querySelector(`[data-staff-chord="${i - 1}"]`) as HTMLButtonElement | null;
                    prev?.focus();
                  }
                  if (e.key === 'ArrowRight' && i < n - 1) {
                    e.preventDefault();
                    const next = document.querySelector(`[data-staff-chord="${i + 1}"]`) as HTMLButtonElement | null;
                    next?.focus();
                  }
                }}
                aria-label={`Chord ${i + 1} of ${n}: ${chord.symbol}, ${chord.roman_numeral}. ${isSelected ? 'Selected.' : 'Select to show piano and guitar.'}`}
                aria-pressed={isSelected}
                data-staff-chord={i}
                tabIndex={0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function getVexFlowKeys(pitches: number[], bass: number): string[] {
  if (pitches.length === 0) return [];

  const bassPc = ((bass % 12) + 12) % 12;
  const sorted = [...pitches].sort((a, b) => a - b);
  const keys: { key: string; midi: number }[] = [];
  const bassNote = pitchToNoteName(bassPc).toLowerCase().replace('#', '#');
  keys.push({ key: `${bassNote}/3`, midi: bassPc + 36 });

  const remaining = sorted.filter(p => ((p % 12) + 12) % 12 !== bassPc);
  let prevPc = bassPc;
  let currentOctave = 4;

  for (const p of remaining) {
    const pc = ((p % 12) + 12) % 12;
    if (pc <= prevPc && currentOctave === 4) currentOctave = 5;
    const name = pitchToNoteName(pc).toLowerCase().replace('#', '#');
    keys.push({ key: `${name}/${currentOctave}`, midi: pc + currentOctave * 12 });
    prevPc = pc;
  }

  keys.sort((a, b) => a.midi - b.midi);
  return keys.map(k => k.key);
}
