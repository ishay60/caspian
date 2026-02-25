/**
 * Metronome utility — reusable click track synthesis via Web Audio API.
 */

/** Play a metronome click at the given time. */
export function playClick(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number,
  isDownbeat: boolean,
) {
  const freq = isDownbeat ? 800 : 600;
  const duration = 0.03;
  const volume = 0.35;

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, startTime);

  const env = ctx.createGain();
  env.gain.setValueAtTime(volume, startTime);
  env.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(env);
  env.connect(dest);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}
