import * as cheerio from 'cheerio';
import { LRCProvider } from './base.js';
import { Lyrics } from '../lyrics.js';
import { getBestMatch } from '../utils.js';
import type { ILyrics, ProviderOptions } from '../types.js';

export class Lyricsify extends LRCProvider {
  public readonly name = 'Lyricsify';

  public static readonly ROOT_URL = 'https://www.lyricsify.com';
  public static readonly SEARCH_ENDPOINT = `${Lyricsify.ROOT_URL}/search`;

  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  public async getLrc(searchTerm: string): Promise<ILyrics | null> {
    try {
      const html = await this.get<string>(Lyricsify.SEARCH_ENDPOINT, {
        params: { q: searchTerm },
        responseType: 'text' as any,
      });

      if (!html || typeof html !== 'string') return null;

      const $ = cheerio.load(html);
      const links: { href: string; text: string }[] = [];

      $('a[href^="/lyric/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          links.push({
            href,
            text: $(el).text().toLowerCase().replace(/-/g, ' ').trim(),
          });
        }
      });

      if (links.length === 0) return null;

      const match = getBestMatch(links, searchTerm, (item) => item.text, 55);
      if (!match) return null;

      const lrcId = match.href.split('.').pop();
      const pageHtml = await this.get<string>(`${Lyricsify.ROOT_URL}${match.href}`, {
        responseType: 'text' as any,
      });

      if (!pageHtml) return null;

      const page$ = cheerio.load(pageHtml);
      const lrcText = page$(`div#lyrics_${lrcId}_details`).text();

      if (lrcText) {
        const lyrics = new Lyrics();
        lyrics.addUnknown(lrcText);
        return lyrics;
      }
    } catch (err: any) {
      this.logger.debug('Lyricsify provider error:', err?.message ?? err);
    }
    return null;
  }
}
