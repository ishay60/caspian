import { useRef, useEffect } from 'react';
import type { ChordAnalysis, Key } from '../types';
import { getChordColor } from '../lib/chordColor';
import { pitchToNoteName } from '../lib/musicTheory';

interface Props {
  chords: ChordAnalysis[];
  keyInfo: Key;
  selectedIndex: number | null;
  onSelect: (i: number) => void;
}

/**
 * Renders chord noteheads on a treble clef staff using VexFlow.
 * Each chord is drawn as stacked whole notes with colored noteheads,
 * chord symbol above and roman numeral below.
 */
export function StaffNotation({ chords, keyInfo, selectedIndex, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const container = containerRef.current;
      if (!container || chords.length === 0) return;

      // Dynamic import VexFlow
      const VF = await import('vexflow');
      if (cancelled) return;

      container.innerHTML = '';

      const chordWidth = 80;
      const padding = 40;
      const totalWidth = Math.max(chords.length * chordWidth + padding * 2, 300);
      const staveY = 40;

      const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
      renderer.resize(totalWidth, 180);
      const context = renderer.getContext();
      context.setFont('IBM Plex Sans', 12);

      const stave = new VF.Stave(10, staveY, totalWidth - 20);
      stave.addClef('treble');

      // Key signature
      const keyName = keyInfo.root_name + (keyInfo.mode === 'minor' ? 'm' : '');
      try {
        stave.addKeySignature(keyName);
      } catch {
        // VexFlow may not support all key names — skip silently
      }

      stave.setContext(context).draw();

      // Apply dark-theme colors to staff lines
      const svg = container.querySelector('svg');
      if (svg) {
        svg.style.overflow = 'visible';
        // Color staff lines and clef using theme variable
        const staffColor = getComputedStyle(document.documentElement).getPropertyValue('--color-staff-line').trim() || '#475569';
        svg.querySelectorAll('path, line, rect').forEach(el => {
          const stroke = el.getAttribute('stroke');
          const fill = el.getAttribute('fill');
          if (stroke === '#000000' || stroke === 'black') el.setAttribute('stroke', staffColor);
          if (fill === '#000000' || fill === 'black') el.setAttribute('fill', staffColor);
        });
      }

      // Build notes
      const notes: InstanceType<typeof VF.StaveNote>[] = [];

      for (let i = 0; i < chords.length; i++) {
        const chord = chords[i];
        const color = getChordColor(chord);
        const isSelected = selectedIndex === i;

        // Convert pitch classes to VexFlow keys
        const keys = getVexFlowKeys(chord.pitches, chord.bass);

        if (keys.length === 0) {
          // Fallback: rest
          const rest = new VF.StaveNote({
            keys: ['b/4'],
            duration: 'wr',
          });
          notes.push(rest);
          continue;
        }

        const note = new VF.StaveNote({
          keys,
          duration: 'w',
        });

        // Color noteheads
        for (let k = 0; k < keys.length; k++) {
          note.setKeyStyle(k, { fillStyle: color, strokeStyle: color });
        }
        note.setStemStyle({ strokeStyle: 'transparent' });

        if (isSelected) {
          note.setStyle({ fillStyle: color, strokeStyle: color });
        }

        notes.push(note);
      }

      if (notes.length > 0) {
        const voice = new VF.Voice({
          numBeats: chords.length * 4,
          beatValue: 4,
        }).setStrict(false);
        voice.addTickables(notes);

        new VF.Formatter()
          .joinVoices([voice])
          .format([voice], totalWidth - 80);

        voice.draw(context, stave);
      }

      // Draw chord symbols and roman numerals as text overlays
      if (svg) {
        for (let i = 0; i < notes.length; i++) {
          const chord = chords[i];
          const color = getChordColor(chord);
          const bbox = notes[i].getBoundingBox();
          if (!bbox) continue;

          const cx = bbox.getX() + bbox.getW() / 2;

          // Chord symbol above staff
          const symbolText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          symbolText.setAttribute('x', String(cx));
          symbolText.setAttribute('y', String(staveY - 5));
          symbolText.setAttribute('text-anchor', 'middle');
          symbolText.setAttribute('fill', color);
          symbolText.setAttribute('font-family', 'IBM Plex Mono, monospace');
          symbolText.setAttribute('font-size', '12');
          symbolText.setAttribute('font-weight', '600');
          symbolText.textContent = chord.symbol;
          svg.appendChild(symbolText);

          // Roman numeral below staff
          const romanText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          romanText.setAttribute('x', String(cx));
          romanText.setAttribute('y', String(staveY + 90));
          romanText.setAttribute('text-anchor', 'middle');
          const neutralColor = getComputedStyle(document.documentElement).getPropertyValue('--color-neutral').trim() || '#94a3b8';
          romanText.setAttribute('fill', neutralColor);
          romanText.setAttribute('font-family', 'IBM Plex Sans, sans-serif');
          romanText.setAttribute('font-size', '11');
          romanText.textContent = chord.roman_numeral;
          svg.appendChild(romanText);

          // Clickable overlay
          const clickRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          clickRect.setAttribute('x', String(bbox.getX() - 5));
          clickRect.setAttribute('y', String(staveY - 15));
          clickRect.setAttribute('width', String(bbox.getW() + 10));
          clickRect.setAttribute('height', '110');
          clickRect.setAttribute('fill', 'transparent');
          clickRect.setAttribute('cursor', 'pointer');
          const idx = i;
          clickRect.addEventListener('click', () => onSelect(idx));
          svg.appendChild(clickRect);

          // Selection highlight
          if (selectedIndex === i) {
            const hlRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hlRect.setAttribute('x', String(bbox.getX() - 8));
            hlRect.setAttribute('y', String(staveY - 10));
            hlRect.setAttribute('width', String(bbox.getW() + 16));
            hlRect.setAttribute('height', '100');
            hlRect.setAttribute('rx', '6');
            hlRect.setAttribute('fill', `${color}`);
            hlRect.setAttribute('opacity', '0.08');
            hlRect.setAttribute('pointer-events', 'none');
            // Insert before text so it's behind
            svg.insertBefore(hlRect, symbolText);
          }
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chords, keyInfo, selectedIndex, onSelect]);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto staff-container"
    />
  );
}

/** Convert pitch classes to VexFlow key strings, arranged from bass up. */
function getVexFlowKeys(pitches: number[], bass: number): string[] {
  if (pitches.length === 0) return [];

  const bassPc = ((bass % 12) + 12) % 12;

  // Assign octaves: start from octave 4, go up
  // Bass note gets the lowest octave
  const sorted = [...pitches].sort((a, b) => a - b);

  const keys: { key: string; midi: number }[] = [];
  let currentOctave = 4;

  // Place bass note first at octave 3
  const bassNote = pitchToNoteName(bassPc).toLowerCase().replace('#', '#');
  keys.push({ key: `${bassNote}/3`, midi: bassPc + 36 });

  // Place remaining pitches starting from octave 4
  const remaining = sorted.filter(p => ((p % 12) + 12) % 12 !== bassPc);
  let prevPc = bassPc;

  for (const p of remaining) {
    const pc = ((p % 12) + 12) % 12;
    // If this pitch class is <= previous, bump octave
    if (pc <= prevPc && currentOctave === 4) {
      currentOctave = 5;
    }
    const name = pitchToNoteName(pc).toLowerCase().replace('#', '#');
    keys.push({ key: `${name}/${currentOctave}`, midi: pc + currentOctave * 12 });
    prevPc = pc;
  }

  // Sort by MIDI value (low to high) as VexFlow expects
  keys.sort((a, b) => a.midi - b.midi);
  return keys.map(k => k.key);
}
