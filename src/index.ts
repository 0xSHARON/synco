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

export * from './types.js';
export * from './lyrics.js';
export * from './utils.js';
export * from './player.js';
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
  const options: SearchOptions =
    typeof optOrPlainOnly === 'object' && optOrPlainOnly !== null
      ? optOrPlainOnly
      : {
          plainOnly: Boolean(optOrPlainOnly),
          syncedOnly: Boolean(syncedOnly),
          savePath,
          providers,
          lang,
          enhanced: Boolean(enhanced),
        };

  const logger = new Logger('synco', Boolean(options.verbose));

  if (options.plainOnly && options.syncedOnly) {
    logger.error('--plain-only and --synced-only flags cannot be used together.');
    return null;
  }

  let targetType = TargetType.PREFER_SYNCED;
  if (options.plainOnly) {
    targetType = TargetType.PLAINTEXT;
  } else if (options.syncedOnly) {
    targetType = TargetType.SYNCED_ONLY;
  }

  const lyrics = new Lyrics();

  const providerInstances: ILRCProvider[] = [
    new Musixmatch({
      lang: options.lang,
      enhanced: options.enhanced,
      musixmatchToken: options.musixmatchToken,
      timeoutMs: options.timeoutMs,
      verbose: options.verbose,
    }),
    new Lrclib({
      timeoutMs: options.timeoutMs,
      verbose: options.verbose,
    }),
    new NetEase({
      timeoutMs: options.timeoutMs,
      verbose: options.verbose,
    }),
    new Megalobiz({
      timeoutMs: options.timeoutMs,
      verbose: options.verbose,
    }),
    new Genius({
      timeoutMs: options.timeoutMs,
      verbose: options.verbose,
    }),
  ];

  const selectedProviders = selectProviders(providerInstances, options.providers, logger);

  for (const provider of selectedProviders) {
    logger.debug(`Looking for an LRC on ${provider.name}`);
    try {
      const result = await provider.getLrc(searchTerm);
      if (result) {
        lyrics.update(result);
      }
    } catch (err: any) {
      logger.error(`An error occurred while searching for an LRC on ${provider.name}:`, err?.message ?? err);
      if (options.lang) {
        logger.error('Aborting, since `lang` is only supported by Musixmatch');
        return null;
      }
      continue;
    }

    if (lyrics.isPreferred(targetType)) {
      logger.info(`Lyrics found for "${searchTerm}" on ${provider.name}`);
      break;
    } else if (lyrics.isAcceptable(targetType)) {
      logger.info(`Found plaintext lyrics on ${provider.name}, but continuing search for synced lyrics`);
    } else {
      logger.debug(`No suitable lyrics found on ${provider.name}, continuing search...`);
    }
  }

  if (!lyrics.isAcceptable(targetType)) {
    logger.info(`No suitable lyrics found for "${searchTerm}" :(`);
    return null;
  }

  if (options.savePath) {
    const formattedPath = options.savePath.replace(/{search_term}/g, searchTerm);
    await lyrics.saveLrcFile(formattedPath, targetType);
  }

  return lyrics.toStr(targetType);
}

function selectProviders(
  allProviders: ILRCProvider[],
  requestedNames?: string[],
  logger?: Logger
): ILRCProvider[] {
  if (!requestedNames || requestedNames.length === 0) {
    return allProviders;
  }

  const lookup = new Set(requestedNames.map((name) => name.toLowerCase().trim()));
  const filtered = allProviders.filter((p) => lookup.has(p.name.toLowerCase()));

  if (filtered.length === 0) {
    logger?.error(
      `Providers [${requestedNames.join(', ')}] not found in the list of available providers.`
    );
    return [];
  }

  return filtered;
}

// Support callable default export as well as object properties
export interface SyncoCallable {
  (searchTerm: string, options?: SearchOptions): Promise<string | null>;
  search: typeof search;
  play: typeof playLyrics;
  playLyrics: typeof playLyrics;
  parseLrc: typeof parseLrc;
  parseTimeTag: typeof parseTimeTag;
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
}

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

