import { Lyrics } from './lyrics.js';
import { TargetType, type SearchOptions, type ILRCProvider } from './types.js';
import {
  Lrclib,
  Megalobiz,
  Musixmatch,
  NetEase,
  Genius,
  Deezer,
  Lyricsify,
  LRCProvider,
} from './providers/index.js';
import { Logger } from './utils.js';

import {
  playLyrics,
  parseLrc,
  parseTimeTag,
  type PlayableLine,
  type PlayerOptions,
  type ParsedLrc,
} from './player.js';

import {
  getTheme,
  listThemes,
  generateEqualizerBars,
  THEMES,
  type ThemeDefinition,
  type ThemeName,
  type AnimationType,
} from './themes.js';

import {
  getSpotifyCurrentTrack,
  resolveSpotifyUrl,
  isSpotifyUrl,
  watchSpotify,
  type SpotifyTrack,
} from './spotify.js';

import {
  getCachedLyrics,
  setCachedLyrics,
  clearCache,
  getCacheStats,
  getCacheDir,
} from './cache.js';

export * from './types.js';
export * from './lyrics.js';
export * from './utils.js';
export * from './player.js';
export * from './themes.js';
export * from './spotify.js';
export * from './cache.js';
export * from './providers/index.js';

/**
 * Searches for LRC format (synchronized) lyrics for a given track.
 */
export async function search(
  searchTerm: string,
  options?: SearchOptions
): Promise<string | null>;
export async function search(
  searchTerm: string,
  plainOnly?: boolean,
  syncedOnly?: boolean,
  savePath?: string,
  providers?: string[],
  lang?: string,
  enhanced?: boolean
): Promise<string | null>;
export async function search(
  searchTerm: string,
  optOrPlainOnly?: SearchOptions | boolean,
  syncedOnly?: boolean,
  savePath?: string,
  providers?: string[],
  lang?: string,
  enhanced?: boolean
): Promise<string | null> {
  let opts: SearchOptions = {};

  if (typeof optOrPlainOnly === 'object' && optOrPlainOnly !== null) {
    opts = { ...optOrPlainOnly };
  } else {
    opts = {
      plainOnly: typeof optOrPlainOnly === 'boolean' ? optOrPlainOnly : false,
      syncedOnly: typeof syncedOnly === 'boolean' ? syncedOnly : false,
      savePath,
      providers,
      lang,
      enhanced,
    };
  }

  const logger = new Logger('synco', opts.verbose ?? false);

  if (opts.plainOnly && opts.syncedOnly) {
    logger.error('--plain-only and --synced-only flags cannot be used together.');
    return null;
  }

  // Handle Spotify URL if passed as searchTerm
  let effectiveSearchTerm = searchTerm;
  if (isSpotifyUrl(searchTerm)) {
    logger.debug(`Resolving Spotify link: ${searchTerm}`);
    const resolved = await resolveSpotifyUrl(searchTerm);
    if (resolved && resolved.query) {
      effectiveSearchTerm = resolved.query;
      logger.debug(`Resolved Spotify track: "${effectiveSearchTerm}"`);
    }
  }

  let targetType = TargetType.PREFER_SYNCED;
  if (opts.syncedOnly) {
    targetType = TargetType.SYNCED_ONLY;
  } else if (opts.plainOnly) {
    targetType = TargetType.PLAINTEXT;
  }

  // Check disk cache first for 0ms instant retrieval
  const cached = getCachedLyrics(effectiveSearchTerm);
  if (cached) {
    logger.debug(`Found cached lyrics for "${effectiveSearchTerm}" (0ms)`);
    if (opts.savePath) {
      const finalPath = opts.savePath.replace('{search_term}', effectiveSearchTerm);
      try {
        const lyr = new Lyrics();
        lyr.addUnknown(cached);
        await lyr.saveLrcFile(finalPath, targetType);
        logger.debug(`Saved cached lyrics to: ${finalPath}`);
      } catch (err: any) {
        logger.error(`Failed to save lyrics file: ${err?.message ?? err}`);
      }
    }
    return cached;
  }

  // Determine provider list
  const providerInstances: ILRCProvider[] = [];
  const requestedProviders = opts.providers?.map((p) => p.toLowerCase());

  const availableProviders: Array<{ name: string; create: () => ILRCProvider }> = [
    {
      name: 'lrclib',
      create: () => new Lrclib({ lang: opts.lang, enhanced: opts.enhanced, timeoutMs: opts.timeoutMs, verbose: opts.verbose }),
    },
    {
      name: 'megalobiz',
      create: () => new Megalobiz({ lang: opts.lang, timeoutMs: opts.timeoutMs, verbose: opts.verbose }),
    },
    {
      name: 'musixmatch',
      create: () =>
        new Musixmatch({
          lang: opts.lang,
          enhanced: opts.enhanced,
          musixmatchToken: opts.musixmatchToken,
          timeoutMs: opts.timeoutMs,
          verbose: opts.verbose,
        }),
    },
    {
      name: 'netease',
      create: () => new NetEase({ lang: opts.lang, timeoutMs: opts.timeoutMs, verbose: opts.verbose }),
    },
    {
      name: 'genius',
      create: () => new Genius({ lang: opts.lang, timeoutMs: opts.timeoutMs, verbose: opts.verbose }),
    },
    {
      name: 'deezer',
      create: () => new Deezer({ lang: opts.lang, timeoutMs: opts.timeoutMs, verbose: opts.verbose }),
    },
    {
      name: 'lyricsify',
      create: () => new Lyricsify({ lang: opts.lang, timeoutMs: opts.timeoutMs, verbose: opts.verbose }),
    },
  ];

  if (requestedProviders && requestedProviders.length > 0) {
    for (const req of requestedProviders) {
      const match = availableProviders.find((p) => p.name === req);
      if (match) {
        providerInstances.push(match.create());
      } else {
        logger.warn(`Provider '${req}' not recognized. Ignoring.`);
      }
    }
  } else {
    // Default providers in order of speed and accuracy
    const defaultList = ['lrclib', 'megalobiz', 'musixmatch', 'netease', 'genius'];
    for (const name of defaultList) {
      const match = availableProviders.find((p) => p.name === name);
      if (match) {
        providerInstances.push(match.create());
      }
    }
  }

  logger.debug(`Searching for "${effectiveSearchTerm}" with target=${targetType}`);

  const combinedLyrics = new Lyrics();

  for (const provider of providerInstances) {
    try {
      logger.debug(`Checking provider: ${provider.name}`);
      const lrc = await provider.getLrc(effectiveSearchTerm);
      if (lrc) {
        combinedLyrics.update(lrc);
        if (combinedLyrics.isPreferred(targetType)) {
          logger.debug(`Found preferred lyrics from: ${provider.name}`);
          break;
        }
      }
    } catch (err: any) {
      logger.debug(`Error from provider ${provider.name}: ${err?.message ?? err}`);
    }
  }

  const result = combinedLyrics.toStr(targetType);

  if (result) {
    // Automatically cache valid lyrics for 0ms subsequent retrieval
    setCachedLyrics(effectiveSearchTerm, result);

    if (opts.savePath) {
      const finalPath = opts.savePath.replace('{search_term}', effectiveSearchTerm);
      try {
        await combinedLyrics.saveLrcFile(finalPath, targetType);
        logger.debug(`Saved lyrics to: ${finalPath}`);
      } catch (err: any) {
        logger.error(`Failed to save lyrics file: ${err?.message ?? err}`);
      }
    }
  }

  return result;
}

export type SyncoCallable = {
  (searchTerm: string, options?: SearchOptions): Promise<string | null>;
  search: typeof search;
  play: typeof playLyrics;
  playLyrics: typeof playLyrics;
  parseLrc: typeof parseLrc;
  parseTimeTag: typeof parseTimeTag;
  getTheme: typeof getTheme;
  listThemes: typeof listThemes;
  generateEqualizerBars: typeof generateEqualizerBars;
  getSpotifyCurrentTrack: typeof getSpotifyCurrentTrack;
  resolveSpotifyUrl: typeof resolveSpotifyUrl;
  isSpotifyUrl: typeof isSpotifyUrl;
  watchSpotify: typeof watchSpotify;
  getCachedLyrics: typeof getCachedLyrics;
  setCachedLyrics: typeof setCachedLyrics;
  clearCache: typeof clearCache;
  getCacheStats: typeof getCacheStats;
  getCacheDir: typeof getCacheDir;
  THEMES: typeof THEMES;
  Lyrics: typeof Lyrics;
  TargetType: typeof TargetType;
  LRCProvider: typeof LRCProvider;
  Lrclib: typeof Lrclib;
  Megalobiz: typeof Megalobiz;
  Musixmatch: typeof Musixmatch;
  NetEase: typeof NetEase;
  Genius: typeof Genius;
  Deezer: typeof Deezer;
  Lyricsify: typeof Lyricsify;
};

export const synco = Object.assign(
  function (searchTerm: string, options?: SearchOptions) {
    return search(searchTerm, options);
  },
  {
    search,
    play: playLyrics,
    playLyrics,
    parseLrc,
    parseTimeTag,
    getTheme,
    listThemes,
    generateEqualizerBars,
    getSpotifyCurrentTrack,
    resolveSpotifyUrl,
    isSpotifyUrl,
    watchSpotify,
    getCachedLyrics,
    setCachedLyrics,
    clearCache,
    getCacheStats,
    getCacheDir,
    THEMES,
    Lyrics,
    TargetType,
    LRCProvider,
    Lrclib,
    Megalobiz,
    Musixmatch,
    NetEase,
    Genius,
    Deezer,
    Lyricsify,
  }
) as SyncoCallable;

export const syncedlyrics = synco;
export default synco;
