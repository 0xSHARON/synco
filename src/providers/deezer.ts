import { LRCProvider } from './base.js';
import { Lyrics } from '../lyrics.js';
import { getBestMatch } from '../utils.js';
import type { ILyrics, ProviderOptions } from '../types.js';

export class Deezer extends LRCProvider {
  public readonly name = 'Deezer';

  public static readonly SEARCH_ENDPOINT = 'https://api.deezer.com/search';
  public static readonly API_ENDPOINT = 'https://www.deezer.com/ajax/gw-light.php';
  private token = 'null';

  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  private async initializeToken(): Promise<void> {
    if (this.token !== 'null') return;
    try {
      const data = await this.apiCall('deezer.getUserData');
      const checkForm = data?.results?.checkForm;
      if (checkForm) {
        this.token = checkForm;
      }
    } catch {
      // Ignore token initialization failures
    }
  }

  private async apiCall(method: string, jsonData?: any): Promise<any> {
    return this.post(
      Deezer.API_ENDPOINT,
      jsonData,
      {
        params: {
          api_version: '1.0',
          api_token: this.token,
          input: '3',
          method,
        },
      }
    );
  }

  public async getLrcById(trackId: string | number): Promise<ILyrics | null> {
    await this.initializeToken();
    const res = await this.apiCall('song.getLyrics', { sng_id: trackId });
    const results = res?.results;
    if (!results) return null;

    const lyrics = new Lyrics();
    const syncJson = results.LYRICS_SYNC_JSON;

    if (!syncJson || !Array.isArray(syncJson)) {
      lyrics.unsynced = results.LYRICS_TEXT || null;
      return lyrics.unsynced ? lyrics : null;
    }

    let lrcStr = '';
    for (const chunk of syncJson) {
      if (chunk?.lrc_timestamp && chunk?.line) {
        lrcStr += `${chunk.lrc_timestamp} ${chunk.line}\n`;
      }
    }

    lyrics.synced = lrcStr.trim() ? lrcStr : null;
    return lyrics;
  }

  public async getLrc(searchTerm: string): Promise<ILyrics | null> {
    const data = await this.get<any>(Deezer.SEARCH_ENDPOINT, {
      params: { q: searchTerm },
    });

    const tracks = data?.data;
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return null;
    }

    const match = getBestMatch(
      tracks,
      searchTerm,
      (t) => `${t.title} ${t.artist?.name ?? ''}`
    );

    if (!match?.id) return null;
    return this.getLrcById(match.id);
  }
}
