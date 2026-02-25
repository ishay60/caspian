import type { AnalysisResult, DetectFormatResponse, LlmAnalysisResult, Section, SearchResult } from './types';

export async function analyzeChords(text: string): Promise<AnalysisResult> {
  const resp = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Analysis failed: ${msg}`);
  }
  return resp.json();
}

export async function analyzeSectionChords(
  sectionName: string,
  chordSymbols: string[],
  keyRootName: string,
  keyMode: string,
): Promise<Section> {
  const resp = await fetch('/api/analyze-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section_name: sectionName,
      chord_symbols: chordSymbols,
      key_root_name: keyRootName,
      key_mode: keyMode,
    }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: 'Analysis failed' }));
    throw new Error(body.detail ?? 'Analysis failed');
  }
  return resp.json();
}

export async function getChordCompletions(
  prefix: string,
  keyRootName: string,
  keyMode: string,
  prevChord?: string,
  nextChord?: string,
  limit = 30,
): Promise<string[]> {
  const params = new URLSearchParams({
    prefix,
    key_root_name: keyRootName,
    key_mode: keyMode,
    limit: String(limit),
  });
  if (prevChord != null && prevChord !== '') params.set('prev_chord', prevChord);
  if (nextChord != null && nextChord !== '') params.set('next_chord', nextChord);
  const resp = await fetch(`/api/chord-completions?${params.toString()}`);
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: 'Chord completion failed' }));
    throw new Error(body.detail ?? 'Chord completion failed');
  }
  const data = await resp.json();
  return data.completions ?? [];
}

export async function requestLlmAnalysis(
  analysisResult: AnalysisResult,
  options?: { anthropicApiKey?: string; openaiApiKey?: string },
): Promise<LlmAnalysisResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.anthropicApiKey) headers['X-Anthropic-Api-Key'] = options.anthropicApiKey;
  else if (options?.openaiApiKey) headers['X-OpenAI-Api-Key'] = options.openaiApiKey;

  const resp = await fetch('/api/llm-analyze', {
    method: 'POST',
    headers,
    body: JSON.stringify(analysisResult),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: 'LLM analysis failed' }));
    throw new Error(body.detail ?? 'LLM analysis failed');
  }
  return resp.json();
}

export interface SearchSongsResponse {
  query: string;
  source: string;
  results: SearchResult[];
  total: number;
}

export async function searchSongs(
  query: string,
  source: 'all' | 'ug' | 'tab4u' = 'all',
  limit: number = 10
): Promise<SearchSongsResponse> {
  const params = new URLSearchParams({
    q: query,
    source,
    limit: limit.toString()
  });

  const resp = await fetch(`/api/search-songs?${params}`);

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Search failed: ${msg}`);
  }

  return resp.json();
}

export async function fetchSheet(url: string): Promise<AnalysisResult> {
  const params = new URLSearchParams({ url });

  const resp = await fetch(`/api/fetch-sheet?${params}`);

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Fetch failed: ${msg}`);
  }

  return resp.json();
}

export async function detectFormat(
  text: string,
  formatHint?: string
): Promise<DetectFormatResponse> {
  const resp = await fetch('/api/detect-format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, format_hint: formatHint }),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Format detection failed: ${msg}`);
  }

  return resp.json();
}

// ── Song CRUD (cloud persistence) ──────────────────────────────────

export interface CloudSong {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  key_root: string;
  key_mode: string;
  input_text: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  metadata: Record<string, unknown>;
  analysis_metadata: Record<string, unknown> | null;
}

export interface SaveSongPayload {
  title: string;
  artist: string;
  key_root: string;
  key_mode: string;
  input_text: string;
  metadata?: Record<string, unknown>;
  analysis_metadata?: Record<string, unknown> | null;
}

export async function listCloudSongs(
  query?: string,
  limit?: number,
): Promise<CloudSong[]> {
  const params = new URLSearchParams();
  if (query != null && query !== '') params.set('q', query);
  if (limit != null) params.set('limit', String(limit));

  const qs = params.toString();
  const resp = await fetch(`/api/songs${qs ? `?${qs}` : ''}`, {
    headers: { 'x-user-id': 'local' },
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Failed to list songs: ${msg}`);
  }

  return resp.json();
}

export async function createCloudSong(
  payload: SaveSongPayload,
): Promise<CloudSong> {
  const resp = await fetch('/api/songs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'local' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Failed to create song: ${msg}`);
  }

  return resp.json();
}

export async function getCloudSong(songId: string): Promise<CloudSong> {
  const resp = await fetch(`/api/songs/${encodeURIComponent(songId)}`, {
    headers: { 'x-user-id': 'local' },
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Failed to get song: ${msg}`);
  }

  return resp.json();
}

export async function updateCloudSong(
  songId: string,
  payload: SaveSongPayload,
): Promise<CloudSong> {
  const resp = await fetch(`/api/songs/${encodeURIComponent(songId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'local' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Failed to update song: ${msg}`);
  }

  return resp.json();
}

export async function touchCloudSong(songId: string): Promise<void> {
  const resp = await fetch(`/api/songs/${encodeURIComponent(songId)}/touch`, {
    method: 'POST',
    headers: { 'x-user-id': 'local' },
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Failed to touch song: ${msg}`);
  }
}

export async function deleteCloudSong(songId: string): Promise<void> {
  const resp = await fetch(`/api/songs/${encodeURIComponent(songId)}`, {
    method: 'DELETE',
    headers: { 'x-user-id': 'local' },
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Failed to delete song: ${msg}`);
  }
}
