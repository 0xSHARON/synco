import * as cheerio from 'cheerio';
import { LRCProvider } from './base.js';
import { Lyrics } from '../lyrics.js';
import { getBestMatch, sortResults } from '../utils.js';
import type { ILyrics, ProviderOptions } from '../types.js';

interface MegalobizResult {
  id: number;
  title: string;
  artist: string;
  duration?: number;
  lrc_url?: string;
  url?: string;
}

interface MegalobizApiResponse {
  count?: number;
  results?: MegalobizResult[];
}

export class Megalobiz extends LRCProvider {
  public readonly name = 'Megalobiz';

  public static readonly ROOT_URL = 'https://www.megalobiz.com';
  public static readonly API_ENDPOINT = 'https://api.megalobiz.com/api/public/v1';

  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  public async getLrc(searchTerm: string): Promise<ILyrics | null> {
    // 1. Try official public API first
    const apiResult = await this.getViaApi(searchTerm);
    if (apiResult) return apiResult;

    // 2. Fallback to website search if API is unavailable
    return this.getViaWeb(searchTerm);
  }

  private async getViaApi(searchTerm: string): Promise<ILyrics | null> {
    try {
      const data = await this.get<MegalobizApiResponse>(
        `${Megalobiz.API_ENDPOINT}/search`,
        {
          params: { q: searchTerm },
          headers: {
            'User-Agent': 'syncedlyrics-node/1.0 (https://github.com/0xSHARON/syncedlyrics)',
          },
        }
      );

      const items = data?.results;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return null;
      }

      const match = getBestMatch(
        items,
        searchTerm,
        (t) => `${t.artist} ${t.title}`,
        60
      );

      const chosen = match || items[0];
      const lrcUrl = chosen.lrc_url || `${Megalobiz.API_ENDPOINT}/lrc/${chosen.id}?format=lrc`;

      const lrcResponse = await this.session.get<string>(lrcUrl, {
        headers: {
          'User-Agent': 'syncedlyrics-node/1.0 (https://github.com/0xSHARON/syncedlyrics)',
        },
        responseType: 'text',
      });

      if (lrcResponse.status === 200 && lrcResponse.data) {
        const lyrics = new Lyrics();
        lyrics.addUnknown(lrcResponse.data);
        return lyrics;
      }
    } catch (err: any) {
      this.logger.debug('Megalobiz API error:', err?.message ?? err);
    }
    return null;
  }

  private async getViaWeb(searchTerm: string): Promise<ILyrics | null> {
    try {
      const query = searchTerm.replace(/\s+/g, '+');
      const searchUrl = `${Megalobiz.ROOT_URL}/search/all?qry=${query}&searchButton.x=0&searchButton.y=0`;
      const html = await this.get<string>(searchUrl, { responseType: 'text' as any });
      if (!html || typeof html !== 'string') return null;

      const $ = cheerio.load(html);
      const links: { href: string; text: string }[] = [];

      $('a[href^="/lrc/maker/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const rawText = $(el).text().replace(/by/gi, '').trim();
          const words = rawText.split(/\s+/).slice(0, searchTerm.split(/\s+/).length + 1);
          links.push({ href, text: words.join(' ') });
        }
      });

      if (links.length === 0) return null;

      const match = getBestMatch(links, searchTerm, (item) => item.text, 55);
      if (!match) return null;

      const lrcPageUrl = `${Megalobiz.ROOT_URL}${match.href}`;
      const pageHtml = await this.get<string>(lrcPageUrl, { responseType: 'text' as any });
      if (!pageHtml) return null;

      const lrcId = match.href.split('.').pop();
      const page$ = cheerio.load(pageHtml);
      const lrcText = page$(`div#lrc_${lrcId}_details`).text();

      if (lrcText) {
        const lyrics = new Lyrics();
        lyrics.addUnknown(lrcText);
        return lyrics;
      }
    } catch (err: any) {
      this.logger.debug('Megalobiz web scraper error:', err?.message ?? err);
    }
    return null;
  }
}
