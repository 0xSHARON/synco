import { LRCProvider } from './base.js';
import { Lyrics } from '../lyrics.js';
import { sortResults, type Logger } from '../utils.js';
import type { ILyrics, ProviderOptions } from '../types.js';

interface LrclibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export class Lrclib extends LRCProvider {
  public readonly name = 'Lrclib';

  public static readonly ROOT_URL = 'https://lrclib.net';
  public static readonly API_ENDPOINT = `${Lrclib.ROOT_URL}/api`;
  public static readonly SEARCH_ENDPOINT = `${Lrclib.API_ENDPOINT}/search`;
  public static readonly LRC_ENDPOINT = `${Lrclib.API_ENDPOINT}/get/`;

  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  public async getLrcById(trackId: string | number): Promise<ILyrics | null> {
    const url = `${Lrclib.LRC_ENDPOINT}${trackId}`;
    const data = await this.get<LrclibTrack>(url);
    if (!data) return null;

    const lyrics = new Lyrics();
    lyrics.synced = data.syncedLyrics || null;
    lyrics.unsynced = data.plainLyrics || null;
    return lyrics;
  }

  public async getLrc(searchTerm: string): Promise<ILyrics | null> {
    const data = await this.get<LrclibTrack[]>(Lrclib.SEARCH_ENDPOINT, {
      params: { q: searchTerm },
    });

    if (!data || !Array.isArray(data) || data.length === 0) {
      this.logger.debug(`No tracks found on Lrclib for "${searchTerm}"`);
      return null;
    }

    const sorted = sortResults(
      data,
      searchTerm,
      (t) => `${t.artistName} - ${t.trackName}`
    );

    const best = sorted[0];
    if (!best) return null;

    // If search result already contains lyrics, return them directly
    if (best.syncedLyrics || best.plainLyrics) {
      return new Lyrics(best.syncedLyrics || null, best.plainLyrics || null);
    }

    return this.getLrcById(best.id);
  }
}
