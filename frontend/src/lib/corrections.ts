/**
 * Correction Manager for Local User Corrections
 *
 * Handles storage, retrieval, and application of user corrections to Hebrew songs from Tab4u.
 * Phase 2: Local storage only
 * Phase 7+: Sync with cloud database and community voting
 */

// Types

export type CorrectionType =
  | 'chord_symbol'
  | 'section_boundary'
  | 'section_addition'
  | 'alignment';

export interface ChordPosition {
  section: string;
  line_index: number;
  chord_index: number;
}

export interface ChordSymbolCorrection {
  type: 'chord_symbol';
  position: ChordPosition;
  original: string;
  corrected: string;
  user_note?: string;
  timestamp: string;
}

export interface SectionBoundaryCorrection {
  type: 'section_boundary';
  section: string;
  original_start_line: number;
  corrected_start_line: number;
  timestamp: string;
}

export interface SectionAdditionCorrection {
  type: 'section_addition';
  section_name: string;
  insert_after: string;
  content: string; // raw chord sheet content
  timestamp: string;
}

export interface AlignmentAdjustment {
  chord: string;
  original_col: number;
  corrected_col: number;
}

export interface AlignmentCorrection {
  type: 'alignment';
  section: string;
  line_index: number;
  adjustments: AlignmentAdjustment[];
  timestamp: string;
}

export type Correction =
  | ChordSymbolCorrection
  | SectionBoundaryCorrection
  | SectionAdditionCorrection
  | AlignmentCorrection;

export interface SongCorrection {
  url: string;
  source: 'tab4u' | 'ultimate_guitar' | 'shironet';
  song_title?: string;
  artist?: string;
  corrections: Correction[];
  corrected_at: string; // ISO timestamp of last correction
  version: string; // correction format version
}

interface CorrectionsStorage {
  [url: string]: SongCorrection;
}

// Correction Manager Class

class CorrectionManager {
  private readonly STORAGE_KEY = 'caspian_corrections';
  private readonly VERSION = '1.0';

  /**
   * Get all corrections for a specific song URL
   */
  getCorrections(url: string): SongCorrection | null {
    const all = this.getAllCorrections();
    return all[url] || null;
  }

  /**
   * Save a new correction for a song
   * Merges with existing corrections for the same URL
   */
  saveCorrection(url: string, correction: Correction, metadata?: {
    source?: 'tab4u' | 'ultimate_guitar' | 'shironet';
    song_title?: string;
    artist?: string;
  }): void {
    const all = this.getAllCorrections();
    const existing = all[url];

    if (existing) {
      // Merge with existing corrections
      existing.corrections.push(correction);
      existing.corrected_at = new Date().toISOString();
    } else {
      // Create new correction entry
      all[url] = {
        url,
        source: metadata?.source || 'tab4u',
        song_title: metadata?.song_title,
        artist: metadata?.artist,
        corrections: [correction],
        corrected_at: new Date().toISOString(),
        version: this.VERSION
      };
    }

    this.saveAllCorrections(all);
  }

  /**
   * Check if a song has any local corrections
   */
  hasCorrections(url: string): boolean {
    return this.getCorrections(url) !== null;
  }

  /**
   * Get the count of corrections for a song
   */
  getCorrectionCount(url: string): number {
    const corrections = this.getCorrections(url);
    return corrections ? corrections.corrections.length : 0;
  }

  /**
   * Remove a specific correction by index
   */
  removeCorrection(url: string, index: number): void {
    const all = this.getAllCorrections();
    const song = all[url];

    if (song && index >= 0 && index < song.corrections.length) {
      song.corrections.splice(index, 1);
      song.corrected_at = new Date().toISOString();

      // If no corrections left, remove entire entry
      if (song.corrections.length === 0) {
        delete all[url];
      }

      this.saveAllCorrections(all);
    }
  }

  /**
   * Clear all corrections for a song
   */
  clearCorrections(url: string): void {
    const all = this.getAllCorrections();
    delete all[url];
    this.saveAllCorrections(all);
  }

  /**
   * Clear all corrections (for all songs)
   */
  clearAllCorrections(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Export corrections for a song as JSON
   */
  exportCorrections(url: string): string | null {
    const corrections = this.getCorrections(url);
    if (!corrections) return null;

    return JSON.stringify(corrections, null, 2);
  }

  /**
   * Export all corrections as JSON
   */
  exportAllCorrections(): string {
    const all = this.getAllCorrections();
    return JSON.stringify(all, null, 2);
  }

  /**
   * Import corrections from JSON
   * Merges with existing corrections
   */
  importCorrections(json: string): { success: boolean; message: string; imported: number } {
    try {
      const imported = JSON.parse(json) as SongCorrection | CorrectionsStorage;

      // Check if it's a single song correction or multiple
      if ('url' in imported && 'corrections' in imported) {
        // Single song correction
        const all = this.getAllCorrections();
        all[imported.url] = imported;
        this.saveAllCorrections(all);
        return {
          success: true,
          message: `Imported ${imported.corrections.length} corrections for 1 song`,
          imported: 1
        };
      } else {
        // Multiple songs
        const all = this.getAllCorrections();
        let count = 0;

        for (const [url, songCorrection] of Object.entries(imported)) {
          all[url] = songCorrection;
          count++;
        }

        this.saveAllCorrections(all);
        return {
          success: true,
          message: `Imported corrections for ${count} songs`,
          imported: count
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        imported: 0
      };
    }
  }

  /**
   * Get statistics about corrections
   */
  getStats(): {
    total_songs: number;
    total_corrections: number;
    by_type: Record<CorrectionType, number>;
  } {
    const all = this.getAllCorrections();
    const songs = Object.values(all);

    const by_type: Record<CorrectionType, number> = {
      chord_symbol: 0,
      section_boundary: 0,
      section_addition: 0,
      alignment: 0
    };

    let total_corrections = 0;

    for (const song of songs) {
      for (const correction of song.corrections) {
        by_type[correction.type]++;
        total_corrections++;
      }
    }

    return {
      total_songs: songs.length,
      total_corrections,
      by_type
    };
  }

  /**
   * List all songs with corrections
   */
  listCorrectedSongs(): Array<{
    url: string;
    title?: string;
    artist?: string;
    source: string;
    correction_count: number;
    last_corrected: string;
  }> {
    const all = this.getAllCorrections();

    return Object.values(all).map(song => ({
      url: song.url,
      title: song.song_title,
      artist: song.artist,
      source: song.source,
      correction_count: song.corrections.length,
      last_corrected: song.corrected_at
    }));
  }

  // Private methods

  private getAllCorrections(): CorrectionsStorage {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to load corrections from localStorage:', error);
      return {};
    }
  }

  private saveAllCorrections(corrections: CorrectionsStorage): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(corrections));
    } catch (error) {
      console.error('Failed to save corrections to localStorage:', error);
      throw new Error('Failed to save corrections. Storage may be full.');
    }
  }
}

// Singleton instance
export const correctionManager = new CorrectionManager();

// Helper functions for applying corrections

/**
 * Apply corrections to raw chord sheet text
 * This is a placeholder - actual implementation depends on analysis structure
 */
export function applyCorrectionsToSheet(
  originalSheet: string,
  corrections: Correction[]
): string {
  // TODO: Implement in Phase 2 when integrating with analysis pipeline
  // For now, return original
  console.warn('applyCorrectionsToSheet not yet implemented');
  return originalSheet;
}

/**
 * Validate that a chord symbol is parseable
 */
export function validateChordSymbol(chord: string): boolean {
  // Basic validation - enhance with actual parser in integration
  const chordPattern = /^[A-G][b#]?(m|maj|min|dim|aug)?(\d+)?(sus[24]?)?(\+|-|add\d+)*(\/[A-G][b#]?)?$/i;
  return chordPattern.test(chord);
}

/**
 * Create a correction with timestamp
 */
export function createCorrection<T extends Omit<Correction, 'timestamp'>>(
  correction: T
): Correction {
  return {
    ...correction,
    timestamp: new Date().toISOString()
  } as Correction;
}
