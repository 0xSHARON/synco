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

  public static readonly DIRECT_ENDPOINT = `${Lrclib.API_ENDPOINT}/get`;

  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  public async getLrcByArtistAndTitle(artist: string, title: string): Promise<ILyrics | null> {
    try {
      const data = await this.get<LrclibTrack>(Lrclib.DIRECT_ENDPOINT, {
        params: {
          artist_name: artist,
          track_name: title,
        },
      });
      if (!data) return null;
      if (data.syncedLyrics || data.plainLyrics) {
        return new Lyrics(data.syncedLyrics || null, data.plainLyrics || null);
      }
    } catch {}
    return null;
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
    // Fast path: if query is formatted as "Artist - Title", try exact direct lookup first
    const dashIdx = searchTerm.indexOf(' - ');
    if (dashIdx !== -1) {
      const artist = searchTerm.substring(0, dashIdx).trim();
      const title = searchTerm.substring(dashIdx + 3).trim();
      if (artist && title) {
        const direct = await this.getLrcByArtistAndTitle(artist, title);
        if (direct && direct.synced) {
          return direct;
        }

        // Clean title fallback for direct lookup (e.g. remove " - Remastered", "(feat. ...)", etc.)
        const cleanTitle = title
          .replace(/\s*[\(\[](?:feat\.?|ft\.?|with|featuring|official|video|audio|remaster|live|bonus|deluxe|radio|edit|acoustic)[^\)\]]*[\)\]]/gi, '')
          .replace(/\s*-\s*(?:remaster|live|radio|acoustic|edit).*$/gi, '')
          .trim();
        if (cleanTitle && cleanTitle.toLowerCase() !== title.toLowerCase()) {
          const directClean = await this.getLrcByArtistAndTitle(artist, cleanTitle);
          if (directClean && directClean.synced) {
            return directClean;
          }
        }
      }
    }

    let data = await this.get<LrclibTrack[]>(Lrclib.SEARCH_ENDPOINT, {
      params: { q: searchTerm },
    });

    if (!data || !Array.isArray(data) || data.length === 0) {
      // Fallback search with cleaned query if search term has extra noise
      const cleanTerm = searchTerm
        .replace(/\s*[\(\[](?:feat\.?|ft\.?|with|featuring|official|video|audio|remaster|live|bonus|deluxe|radio|edit|acoustic)[^\)\]]*[\)\]]/gi, '')
        .replace(/\s*-\s*(?:remaster|live|radio|acoustic|edit).*$/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (cleanTerm && cleanTerm.toLowerCase() !== searchTerm.toLowerCase()) {
        data = await this.get<LrclibTrack[]>(Lrclib.SEARCH_ENDPOINT, {
          params: { q: cleanTerm },
        });
      }
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      this.logger.debug(`No tracks found on Lrclib for "${searchTerm}"`);
      return null;
    }

    const sorted = sortResults(
      data,
      searchTerm,
      (t) => `${t.artistName} - ${t.trackName}`
    );

    // Prioritize candidates with synced lyrics first if available
    const bestSynced = sorted.find((t) => Boolean(t.syncedLyrics && t.syncedLyrics.trim()));
    const best = bestSynced || sorted[0];
    if (!best) return null;

    // If search result already contains lyrics, return them directly
    if (best.syncedLyrics || best.plainLyrics) {
      return new Lyrics(best.syncedLyrics || null, best.plainLyrics || null);
    }

    return this.getLrcById(best.id);
  }
}

