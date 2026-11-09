import fs from 'node:fs';
import path from 'node:path';
import { LRCProvider } from './base.js';
import { Lyrics } from '../lyrics.js';
import { getBestMatch, formatTime, getCachePath } from '../utils.js';
import type { ILyrics, ProviderOptions } from '../types.js';

interface CachedTokenData {
  token: string;
  expiration_time: number;
}

export class Musixmatch extends LRCProvider {
  public readonly name = 'Musixmatch';

  public static readonly ROOT_URL = 'https://apic-desktop.musixmatch.com/ws/1.1/';
  private token: string | null = null;
  private lang?: string;
  private enhanced: boolean;

  constructor(options: ProviderOptions = {}) {
    super(options);
    this.lang = options.lang;
    this.enhanced = Boolean(options.enhanced);
    if (options.musixmatchToken || process.env.MUSIXMATCH_TOKEN) {
      this.token = options.musixmatchToken || process.env.MUSIXMATCH_TOKEN || null;
    }
  }

  private async requestApi<T = any>(
    action: string,
    params: Record<string, string | number> = {}
  ): Promise<T | null> {
    if (action !== 'token.get' && !this.token) {
      await this.ensureToken();
    }

    const query: Record<string, string | number> = {
      app_id: 'web-desktop-app-v1.0',
      t: Date.now(),
      ...params,
    };

    if (this.token) {
      query.usertoken = this.token;
    }

    const url = `${Musixmatch.ROOT_URL}${action}`;
    return this.get<T>(url, { params: query });
  }

  private async ensureToken(): Promise<void> {
    const tokenFile = path.join(getCachePath('synco'), 'musixmatch_token.json');
    const currentTime = Math.floor(Date.now() / 1000);

    try {
      if (fs.existsSync(tokenFile)) {
        const raw = fs.readFileSync(tokenFile, 'utf-8');
        const cached: CachedTokenData = JSON.parse(raw);
        if (
          cached.token &&
          cached.token !== '00000000000000000000000000000000000000000000000000000000' &&
          cached.expiration_time &&
          currentTime < cached.expiration_time
        ) {
          this.token = cached.token;
          return;
        }
      }
    } catch {
      // Ignore cache read failures
    }

    const res = await this.requestApi<any>('token.get', { user_language: 'en' });
    const statusCode = res?.message?.header?.status_code;

    if (statusCode === 401) {
      // Retry once after 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return this.ensureToken();
    }

    const newToken = res?.message?.body?.user_token;
    if (newToken && typeof newToken === 'string') {
      this.token = newToken;
      const tokenData: CachedTokenData = {
        token: newToken,
        expiration_time: currentTime + 600, // 10 minutes expiration
      };
      try {
        fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
        fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2), 'utf-8');
      } catch {
        // Cache write is non-fatal
      }
    }
  }

  public async getLrcById(trackId: string | number): Promise<ILyrics | null> {
    const subtitleRes = await this.requestApi<any>('track.subtitle.get', {
      track_id: trackId,
      subtitle_format: 'lrc',
    });

    let translationList: any[] = [];
    if (this.lang) {
      const translationRes = await this.requestApi<any>('crowd.track.translations.get', {
        track_id: trackId,
        subtitle_format: 'lrc',
        translation_fields_set: 'minimal',
        selected_language: this.lang,
      });
      translationList = translationRes?.message?.body?.translations_list || [];
      if (translationList.length === 0) {
        this.logger.debug(`Could not find translations in ${this.lang} for track ${trackId}`);
      }
    }

    const body = subtitleRes?.message?.body;
    let lrcStr = body?.subtitle?.subtitle_body;
    if (!lrcStr || typeof lrcStr !== 'string') {
      return null;
    }

    if (this.lang && translationList.length > 0) {
      for (const item of translationList) {
        const org = item?.translation?.subtitle_matched_line;
        const tr = item?.translation?.description;
        if (org && tr) {
          lrcStr = lrcStr.replace(org, `${org}\n(${tr})`);
        }
      }
    }

    const lyrics = new Lyrics();
    lyrics.synced = lrcStr;
    return lyrics;
  }

  public async getLrcWordByWord(trackId: string | number): Promise<ILyrics | null> {
    const res = await this.requestApi<any>('track.richsync.get', {
      track_id: trackId,
    });

    if (res?.message?.header?.status_code !== 200) {
      return null;
    }

    const rawRichsync = res?.message?.body?.richsync?.richsync_body;
    if (!rawRichsync) return null;

    try {
      const items = typeof rawRichsync === 'string' ? JSON.parse(rawRichsync) : rawRichsync;
      let lrcStr = '';

      for (const item of items) {
        const baseTs = parseFloat(item.ts);
        lrcStr += `[${formatTime(baseTs)}] `;
        if (Array.isArray(item.l)) {
          for (const line of item.l) {
            const wordOffset = parseFloat(line.o);
            const wordTime = formatTime(baseTs + wordOffset);
            lrcStr += `<${wordTime}> ${line.c} `;
          }
        }
        lrcStr += '\n';
      }

      if (lrcStr.trim()) {
        const lyrics = new Lyrics();
        lyrics.synced = lrcStr;
        return lyrics;
      }
    } catch (err: any) {
      this.logger.debug('Failed to parse Musixmatch word-by-word JSON:', err?.message ?? err);
    }

    return null;
  }

  public async getLrc(searchTerm: string): Promise<ILyrics | null> {
    const res = await this.requestApi<any>('track.search', {
      q: searchTerm,
      page_size: 5,
      page: 1,
    });

    const statusCode = res?.message?.header?.status_code;
    if (statusCode !== 200) {
      this.logger.debug(`Musixmatch track.search returned status code ${statusCode}`);
      return null;
    }

    const tracks = res?.message?.body?.track_list;
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return null;
    }

    const match = getBestMatch(
      tracks,
      searchTerm,
      (t) => `${t.track?.track_name} ${t.track?.artist_name}`
    );

    if (!match?.track?.track_id) {
      return null;
    }

    const trackId = match.track.track_id;

    if (this.enhanced) {
      const enhancedLyrics = await this.getLrcWordByWord(trackId);
      if (enhancedLyrics && enhancedLyrics.synced) {
        return enhancedLyrics;
      }
    }

    return this.getLrcById(trackId);
  }
}

