export enum TargetType {
  PLAINTEXT = 'PLAINTEXT',
  PREFER_SYNCED = 'PREFER_SYNCED',
  SYNCED_ONLY = 'SYNCED_ONLY',
}

export type LyricsType = 'synced' | 'plaintext' | 'invalid';

export type { ThemeName, AnimationType, ThemeDefinition, ThemeColors } from './themes.js';
export type { SpotifyTrack } from './spotify.js';

export interface SearchOptions {
  /** Only look for plain text (not synced) lyrics */
  plainOnly?: boolean;
  /** Only look for synced lyrics */
  syncedOnly?: boolean;
  /** Path to save `.lrc` lyrics (e.g. "{search_term}.lrc"). No saving if omitted */
  savePath?: string;
  /** List of provider names to include (e.g. ['lrclib', 'megalobiz', 'netease', 'musixmatch', 'genius']) */
  providers?: string[];
  /** Language code of the translation along with the lyrics (ISO 639-1 format, e.g. 'es', 'de') */
  lang?: string;
  /** Return word-by-word (karaoke style) synced lyrics if available */
  enhanced?: boolean;
  /** Custom Musixmatch user token if available */
  musixmatchToken?: string;
  /** Minimum similarity score between 0 and 100 (default: 65) */
  minScore?: number;
  /** Enable debug logging */
  verbose?: boolean;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
}

export interface ProviderOptions {
  lang?: string;
  enhanced?: boolean;
  musixmatchToken?: string;
  timeoutMs?: number;
  verbose?: boolean;
}

export interface ILRCProvider {
  name: string;
  getLrc(searchTerm: string): Promise<ILyrics | null>;
  getLrcById?(trackId: string): Promise<ILyrics | null>;
}

export interface ILyrics {
  synced?: string | null;
  unsynced?: string | null;
  addUnknown(unknown?: string | null): void;
  update(other?: ILyrics | null): void;
  isPreferred(targetType: TargetType): boolean;
  isAcceptable(targetType: TargetType): boolean;
  toStr(targetType: TargetType): string | null;
  saveLrcFile(filePath: string, targetType: TargetType): Promise<void>;
}

