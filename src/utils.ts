import os from 'node:os';
import path from 'node:path';
import type { LyricsType } from './types.js';

export const R_FEAT = /\((feat.+)\)/i;

/**
 * Converts synced LRC string to plain text by stripping timestamps.
 */
export function syncedToPlaintext(syncedLyrics: string): string {
  if (!syncedLyrics) return '';
  return syncedLyrics
    .replace(/\[\d+:\d+(?:\.\d+)?\]\s*/g, '')
    .replace(/<\d+:\d+(?:\.\d+)?>\s*/g, '')
    .trim();
}

/**
 * Identifies whether an LRC string contains timestamps (synced) or is plaintext.
 */
export function identifyLyricsType(lrc: string): LyricsType {
  if (!lrc || typeof lrc !== 'string' || !lrc.trim()) {
    return 'invalid';
  }
  const lines = lrc.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'invalid';

  const timeTagRegex = /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/;
  const taggedLines = lines.filter((line) => timeTagRegex.test(line));

  // If at least 25% of lines or 3+ lines have timestamps, consider it synced
  if (taggedLines.length >= 2 || (taggedLines.length / lines.length) >= 0.25) {
    return 'synced';
  }
  return 'plaintext';
}

/**
 * Checks whether an LRC string has a translation included below lines.
 */
export function hasTranslation(lrc: string): boolean {
  if (!lrc) return false;
  const lines = lrc.split('\n').slice(3, 15);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('[')) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.includes('(')) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Formats seconds into mm:ss.xx format.
 */
export function formatTime(timeInSeconds: number): string {
  const totalSeconds = Math.max(0, timeInSeconds);
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.floor(totalSeconds % 60);
  let hundredths = Math.round((totalSeconds - Math.floor(totalSeconds)) * 100);

  if (hundredths >= 100) {
    hundredths = 0;
    seconds += 1;
    if (seconds >= 60) {
      seconds = 0;
      minutes += 1;
    }
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

/**
 * Normalizes string by lowering case and stripping non-alphanumeric punctuation.
 */
export function defaultProcess(str: string): string {
  return str.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
}

/**
 * Indel distance calculation (Levenshtein with cost 1 for insert/delete, cost 2 for substitution).
 */
export function indelDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1);
      }
    }
  }
  return dp[m][n];
}

/**
 * Computes the ratio score (0 - 100) between two strings using Indel distance.
 */
export function fuzzRatio(s1: string, s2: string): number {
  if (!s1 && !s2) return 100;
  if (!s1 || !s2) return 0;
  const dist = indelDistance(s1, s2);
  const totalLen = s1.length + s2.length;
  return totalLen === 0 ? 100 : ((totalLen - dist) / totalLen) * 100;
}

/**
 * Calculates RapidFuzz-compatible token_set_ratio.
 */
export function tokenSetRatio(s1: string, s2: string): number {
  const p1 = defaultProcess(s1);
  const p2 = defaultProcess(s2);
  if (!p1 && !p2) return 100;
  if (!p1 || !p2) return 0;

  const t1 = Array.from(new Set(p1.split(/\s+/).filter(Boolean)));
  const t2 = Array.from(new Set(p2.split(/\s+/).filter(Boolean)));

  const set1 = new Set(t1);
  const set2 = new Set(t2);

  const intersection = t1.filter((x) => set2.has(x)).sort();
  const diff1 = t1.filter((x) => !set2.has(x)).sort();
  const diff2 = t2.filter((x) => !set1.has(x)).sort();

  const s0 = intersection.join(' ');
  const s1Rest = diff1.join(' ');
  const s2Rest = diff2.join(' ');

  const combined1 = [s0, s1Rest].filter(Boolean).join(' ');
  const combined2 = [s0, s2Rest].filter(Boolean).join(' ');

  if (!s0) {
    return fuzzRatio(combined1, combined2);
  }

  return Math.max(
    fuzzRatio(s0, combined1),
    fuzzRatio(s0, combined2),
    fuzzRatio(combined1, combined2)
  );
}

/**
 * Returns similarity score between two strings (0 - 100), accounting for feature credits.
 */
export function strScore(a: string, b: string): number {
  let lowerA = (a || '').toLowerCase();
  let lowerB = (b || '').toLowerCase();
  if (!lowerB.includes('feat')) {
    lowerA = lowerA.replace(R_FEAT, '');
    lowerB = lowerB.replace(R_FEAT, '');
  }
  return tokenSetRatio(lowerA, lowerB);
}

/**
 * Returns true if the similarity score between two strings is >= minScore.
 */
export function strSame(a: string, b: string, minScore = 65): boolean {
  return Math.round(strScore(a, b)) >= minScore;
}

/**
 * Sorts results by similarity of comparison key against the search term (descending).
 */
export function sortResults<T>(
  results: T[],
  searchTerm: string,
  compareKey: (item: T) => string
): T[] {
  return [...results].sort((a, b) => {
    const scoreA = strScore(compareKey(a), searchTerm);
    const scoreB = strScore(compareKey(b), searchTerm);
    return scoreB - scoreA;
  });
}

/**
 * Returns the best match from results if its similarity score meets minScore.
 */
export function getBestMatch<T>(
  results: T[],
  searchTerm: string,
  compareKey: (item: T) => string,
  minScore = 65
): T | null {
  if (!results || results.length === 0) return null;
  const sorted = sortResults(results, searchTerm, compareKey);
  const bestMatch = sorted[0];
  const valueToCompare = compareKey(bestMatch);
  if (!strSame(valueToCompare, searchTerm, minScore)) {
    return null;
  }
  return bestMatch;
}

/**
 * Resolves or creates a system cache directory for the library.
 */
export function getCachePath(libName = 'synco'): string {
  const platform = process.platform;
  let baseDir: string;

  if (platform === 'win32') {
    baseDir = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  } else if (platform === 'darwin') {
    baseDir = path.join(os.homedir(), 'Library', 'Caches');
  } else {
    baseDir = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  }

  return path.join(baseDir, libName);
}

/**
 * Simple logger for library and CLI output.
 */
export class Logger {
  constructor(private context: string, private verbose: boolean = false) {}

  public debug(...args: unknown[]): void {
    if (this.verbose) {
      console.error(`[${this.context}] [DEBUG]`, ...args);
    }
  }

  public info(...args: unknown[]): void {
    if (this.verbose) {
      console.error(`[${this.context}] [INFO]`, ...args);
    }
  }

  public warn(...args: unknown[]): void {
    console.error(`[${this.context}] [WARN]`, ...args);
  }

  public error(...args: unknown[]): void {
    console.error(`[${this.context}] [ERROR]`, ...args);
  }
}

/**
 * Sanitizes and normalizes track search queries by stripping noise
 * such as feature tags, audio/video markers, remaster years, and extra brackets.
 */
export function cleanSearchQuery(query: string): string {
  if (!query) return '';
  return query
    // Remove (feat. ...), [feat. ...], (with ...), [with ...]
    .replace(/\s*[\(\[](?:feat\.?|ft\.?|with|featuring)[^\)\]]*[\)\]]/gi, '')
    // Remove (Official Video), (Lyric Video), (Official Audio), [Music Video], etc.
    .replace(/\s*[\(\[](?:official|lyric|audio|video|visualizer|clip)[^\)\]]*[\)\]]/gi, '')
    // Remove (Remastered...), [Remastered...], - Remastered...
    .replace(/\s*[\(\[]remaster(?:ed)?(?:\s+\d{4})?[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*-\s*remaster(?:ed)?(?:\s+\d{4})?.*$/gi, '')
    // Remove (Live...), [Live...], - Live...
    .replace(/\s*[\(\[]live(?:[^\)\]]*)?[\)\]]/gi, '')
    .replace(/\s*-\s*live.*$/gi, '')
    // Remove (Bonus Track), (Deluxe Edition), (Radio Edit), - Radio Edit
    .replace(/\s*[\(\[](?:bonus\s+track|deluxe(?:\s+edition)?|radio\s+edit|acoustic(?:\s+version)?)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*-\s*(?:radio\s+edit|acoustic).*$/gi, '')
    // Clean up multiple spaces, trailing hyphens
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*-\s*$/, '')
    .trim();
}
