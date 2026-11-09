import { LRCProvider } from './base.js';
import { Lyrics } from '../lyrics.js';
import { getBestMatch } from '../utils.js';
import type { ILyrics, ProviderOptions } from '../types.js';

interface NetEaseArtist {
  id: number;
  name: string;
}

interface NetEaseSong {
  id: number;
  name: string;
  artists?: NetEaseArtist[];
}

export class NetEase extends LRCProvider {
  public readonly name = 'NetEase';

  public static readonly API_ENDPOINT_METADATA = 'https://music.163.com/api/search/pc';
  public static readonly API_ENDPOINT_LYRICS = 'https://music.163.com/api/song/lyric';

  constructor(options: ProviderOptions = {}) {
    super(options);
    this.session.defaults.headers.common.Cookie =
      'NMTID=00OAVK3xqDG726ITU6jopU6jF2yMk0AAAGCO8l1BA; JSESSIONID-WYYY=8KQo11YK2GZP45RMlz8Kn80vHZ9%2FGvwzRKQXXy0iQoFKycWdBlQjbfT0MJrFa6hwRfmpfBYKeHliUPH287JC3hNW99WQjrh9b9RmKT%2Fg1Exc2VwHZcsqi7ITxQgfEiee50po28x5xTTZXKoP%2FRMctN2jpDeg57kdZrXz%2FD%2FWghb%5C4DuZ%3A1659124633932; _iuqxldmzr_=32; _ntes_nnid=0db6667097883aa9596ecfe7f188c3ec,1659122833973; _ntes_nuid=0db6667097883aa9596ecfe7f188c3ec;';
    this.session.defaults.headers.common.Referer = 'https://music.163.com/';
  }

  public async searchTrack(searchTerm: string): Promise<NetEaseSong | null> {
    const data = await this.get<any>(NetEase.API_ENDPOINT_METADATA, {
      params: {
        limit: 10,
        type: 1,
        offset: 0,
        s: searchTerm,
      },
    });

    const songs: NetEaseSong[] = data?.result?.songs;
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
      return null;
    }

    const match = getBestMatch(
      songs,
      searchTerm,
      (t) => `${t.name} ${t.artists?.[0]?.name ?? ''}`
    );

    return match || songs[0];
  }

  public async getLrcById(trackId: string | number): Promise<ILyrics | null> {
    const data = await this.get<any>(NetEase.API_ENDPOINT_LYRICS, {
      params: {
        id: trackId,
        lv: 1,
      },
    });

    const lyricText = data?.lrc?.lyric;
    if (!lyricText || typeof lyricText !== 'string') {
      return null;
    }

    const lyrics = new Lyrics();
    lyrics.addUnknown(lyricText);
    return lyrics;
  }

  public async getLrc(searchTerm: string): Promise<ILyrics | null> {
    const track = await this.searchTrack(searchTerm);
    if (!track?.id) return null;
    return this.getLrcById(track.id);
  }
}

