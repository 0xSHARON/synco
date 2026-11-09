import * as cheerio from 'cheerio';
import { LRCProvider } from './base.js';
import { Lyrics } from '../lyrics.js';
import type { ILyrics, ProviderOptions } from '../types.js';

export class Genius extends LRCProvider {
  public readonly name = 'Genius';

  public static readonly SEARCH_ENDPOINT = 'https://genius.com/api/search/multi';

  constructor(options: ProviderOptions = {}) {
    super(options);
    this.session.defaults.headers.common.Cookie = 'obuid=e3ee67e0-7df9-4181-8324-d977c6dc9250;';
    this.session.defaults.headers.common.Referer = 'https://genius.com/';
  }

  public async getLrc(searchTerm: string): Promise<ILyrics | null> {
    try {
      const data = await this.get<any>(Genius.SEARCH_ENDPOINT, {
        params: {
          per_page: 5,
          q: searchTerm,
        },
      });

      const sections = data?.response?.sections;
      if (!sections || !Array.isArray(sections)) return null;

      // Section 1 is usually the song hits
      const songSection = sections.find((s: any) => s.type === 'song') || sections[1] || sections[0];
      const hits = songSection?.hits;
      if (!hits || !Array.isArray(hits) || hits.length === 0) return null;

      const songUrl = hits[0]?.result?.url;
      if (!songUrl) return null;

      const pageHtml = await this.get<string>(songUrl, {
        responseType: 'text' as any,
      });

      if (!pageHtml || typeof pageHtml !== 'string') return null;

      const $ = cheerio.load(pageHtml);
      const containers = $('div[data-lyrics-container="true"]');
      if (containers.length === 0) return null;

      let lrcStr = '';
      containers.each((_, el) => {
        // Replace <br> with newlines
        $(el).find('br').replaceWith('\n');
        const text = $(el).text().trim();
        if (text) {
          lrcStr += `${text}\n\n`;
        }
      });

      const cleaned = lrcStr.trim();
      if (!cleaned) return null;

      const lyrics = new Lyrics();
      lyrics.unsynced = cleaned;
      return lyrics;
    } catch (err: any) {
      this.logger.debug('Genius provider error:', err?.message ?? err);
      return null;
    }
  }
}
