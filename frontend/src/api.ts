import type { AnalysisResult, LlmAnalysisResult, Section, SearchResult } from './types';

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
