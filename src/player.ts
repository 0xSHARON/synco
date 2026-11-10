import readline from 'node:readline';
import { formatTime } from './utils.js';
import {
  getTheme,
  listThemes,
  generateEqualizerBars,
  type ThemeDefinition,
  type ThemeName,
  type AnimationType,
} from './themes.js';
import { getSpotifyCurrentTrack, type SpotifyTrack } from './spotify.js';

export interface WordTag {
  timeSeconds: number;
  word: string;
}

export interface PlayableLine {
  timeSeconds: number;
  rawTime: string;
  text: string;
  words?: WordTag[];
}

export interface PlaybackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  length?: number;
  by?: string;
  offset?: number;
}

export interface ParsedLrc {
  metadata: PlaybackMetadata;
  lines: PlayableLine[];
}

export interface PlayerOptions {
  /** Playback speed multiplier (default: 1.0) */
  speed?: number;
  /** Whether to enable full interactive TTY UI (default: true if stdout is a TTY) */
  interactive?: boolean;
  /** Visual theme name (e.g. 'neon', 'matrix', 'synthwave', 'karaoke', etc.) or theme object */
  theme?: ThemeName | ThemeDefinition | string;
  /** Animation style override */
  animation?: AnimationType;
  /** Continuously sync with Spotify playback */
  syncSpotify?: boolean;
  /** Custom track title override */
  title?: string;
  /** Custom track artist override */
  artist?: string;
  /** Start playback at specific seconds */
  startPosition?: number;
  /** Abort signal to cancel playback programmatically */
  signal?: AbortSignal;
  /** Callback fired whenever the active line changes */
  onLine?: (line: PlayableLine, index: number) => void;
  /** Callback fired on each tick with current playback timestamp in seconds */
  onTick?: (currentTime: number, activeIndex: number) => void;
  /** Callback fired when Spotify switches to another track during playback */
  onSpotifyTrackChange?: (track: SpotifyTrack) => void;
}

/**
 * Converts timestamp string (e.g., "[01:23.45]" or "01:23.45") into seconds.
 */
export function parseTimeTag(tag: string): number {
  const clean = tag.replace(/[\[\]]/g, '').trim();
  const parts = clean.split(':');
  if (parts.length < 2) return 0;

  const minutes = parseInt(parts[0], 10) || 0;
  const seconds = parseFloat(parts[1]) || 0;
  return Math.max(0, minutes * 60 + seconds);
}

/**
 * Parses raw LRC string into structured playable lines and metadata.
 */
export function parseLrc(lrcText: string): ParsedLrc {
  const metadata: PlaybackMetadata = {};
  const lines: PlayableLine[] = [];

  if (!lrcText || typeof lrcText !== 'string') {
    return { metadata, lines };
  }

  const rawLines = lrcText.split('\n');
  const metaRegex = /^\[(ti|ar|al|length|by|offset):([^\]]+)\]/i;
  const timeRegex = /\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g;
  const wordRegex = /<(\d{1,3}):(\d{2}(?:\.\d{1,3})?)>\s*([^<]*)/g;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check metadata tags
    const metaMatch = trimmed.match(metaRegex);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      if (key === 'ti') metadata.title = value;
      else if (key === 'ar') metadata.artist = value;
      else if (key === 'al') metadata.album = value;
      else if (key === 'by') metadata.by = value;
      else if (key === 'offset') metadata.offset = parseInt(value, 10) || 0;
      else if (key === 'length') metadata.length = parseTimeTag(value);
      continue;
    }

    // Extract all leading timestamp tags (handles repeated chorus timestamps like [01:00.00][02:00.00] Chorus)
    const timeMatches = [...trimmed.matchAll(timeRegex)];
    if (timeMatches.length === 0) continue;

    // Remove timestamps to get lyrics text
    const textWithoutTimeTags = trimmed.replace(timeRegex, '').trim();

    // Check for word-by-word karaoke timing (<mm:ss.xx> word)
    const words: WordTag[] = [];
    const cleanWordMatches = [...textWithoutTimeTags.matchAll(wordRegex)];

    let displayText = textWithoutTimeTags;
    if (cleanWordMatches.length > 0) {
      for (const wm of cleanWordMatches) {
        const wordTime = parseTimeTag(`${wm[1]}:${wm[2]}`);
        const word = wm[3];
        if (word.trim()) {
          words.push({ timeSeconds: wordTime, word: word.trim() });
        }
      }
      // Strip word tags for clean display text
      displayText = textWithoutTimeTags.replace(/<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g, '').replace(/\s+/g, ' ').trim();
    }

    for (const tm of timeMatches) {
      const timeSeconds = parseTimeTag(`${tm[1]}:${tm[2]}`);
      lines.push({
        timeSeconds,
        rawTime: `[${tm[1]}:${tm[2]}]`,
        text: displayText,
        words: words.length > 0 ? words : undefined,
      });
    }
  }

  // Adjust for offset if present (LRC offset is in milliseconds)
  if (metadata.offset && metadata.offset !== 0) {
    const offsetSeconds = metadata.offset / 1000;
    for (const line of lines) {
      line.timeSeconds = Math.max(0, line.timeSeconds + offsetSeconds);
    }
  }

  // Sort chronologically
  lines.sort((a, b) => a.timeSeconds - b.timeSeconds);

  // Compute estimated total track length if not provided in metadata
  if (!metadata.length && lines.length > 0) {
    metadata.length = Math.ceil(lines[lines.length - 1].timeSeconds + 6);
  }

  return { metadata, lines };
}

/**
 * Real-time CLI interactive lyrics player with themes, animations, and Spotify sync.
 */
export async function playLyrics(lrcText: string, options: PlayerOptions = {}): Promise<void> {
  const { metadata, lines } = parseLrc(lrcText);

  if (lines.length === 0) {
    console.log('\n❌ No synchronized lines found in lyrics to play.');
    return;
  }

  const isInteractive = options.interactive ?? (Boolean(process.stdout.isTTY) && Boolean(process.stdin.isTTY));
  let speed = Math.max(0.25, Math.min(5.0, options.speed ?? 1.0));
  let playbackPos = options.startPosition ?? 0;
  const totalDuration = metadata.length ?? Math.ceil(lines[lines.length - 1].timeSeconds + 6);
  let isPaused = false;
  let lastActiveIndex = -2;
  let isExited = false;
  let tickCount = 0;

  // Themes list for dynamic cycle switching via 't' key
  const allThemes = listThemes();
  let currentTheme: ThemeDefinition =
    typeof options.theme === 'object' && options.theme !== null
      ? (options.theme as ThemeDefinition)
      : getTheme(typeof options.theme === 'string' ? options.theme : undefined);

  let themeIndex = allThemes.findIndex((t) => t.name === currentTheme.name);
  if (themeIndex === -1) themeIndex = 0;

  let trackTitle = options.title || metadata.title || 'Unknown Track';
  let trackArtist = options.artist || metadata.artist || '';

  const c = {
    clearScreen: '\x1b[2J\x1b[H',
    hideCursor: '\x1b[?25l',
    showCursor: '\x1b[?25h',
  };

  // Helper to render interactive TTY frame
  const renderFrame = (activeIndex: number) => {
    if (!isInteractive) return;

    const termWidth = process.stdout.columns || 80;
    const boxWidth = Math.min(termWidth - 4, 76);
    const th = currentTheme;
    const colors = th.colors;
    const border = colors.frameBorder;

    // Equalizer animation
    const eqBars = generateEqualizerBars(tickCount, isPaused, th, 14);

    // Progress bar calculations
    const pct = Math.min(1, Math.max(0, playbackPos / (totalDuration || 1)));
    const barWidth = 24;
    const filled = Math.round(pct * barWidth);
    const { filled: fChar, playhead: pChar, empty: eChar } = colors.progressBarChar;
    const bar =
      colors.progressFilled +
      fChar.repeat(Math.max(0, filled)) +
      (filled < barWidth ? pChar : fChar) +
      colors.progressEmpty +
      eChar.repeat(Math.max(0, barWidth - filled - 1)) +
      colors.reset;

    let frame = '';
    frame += c.clearScreen;

    // Top border
    frame += `\n  ${colors.primary}${border.topLeft}${border.horizontal.repeat(boxWidth)}${border.topRight}${colors.reset}\n`;

    // Header with Equalizer & Badge
    const headerTitle = `🎵 SYNCO PLAYER ${colors.badge}`;
    const headerPlain = `🎵 SYNCO PLAYER [${th.displayName}]`;
    const spaceAfterHeader = Math.max(2, boxWidth - headerPlain.length - 18);
    frame += `  ${colors.primary}${border.vertical}${colors.reset}  ${colors.bold}${headerTitle}${colors.reset}${' '.repeat(spaceAfterHeader)}${eqBars}  ${colors.primary}${border.vertical}${colors.reset}\n`;

    // Track Title line
    const titleStr = `Track: "${trackTitle}"${trackArtist ? ` — ${trackArtist}` : ''}`;
    const truncatedTitle = titleStr.length > boxWidth - 4 ? titleStr.slice(0, boxWidth - 7) + '...' : titleStr;
    frame += `  ${colors.primary}${border.vertical}${colors.reset}  ${colors.secondary}${truncatedTitle}${colors.reset}${' '.repeat(Math.max(0, boxWidth - truncatedTitle.length - 2))} ${colors.primary}${border.vertical}${colors.reset}\n`;

    // Spacer
    frame += `  ${colors.primary}${border.vertical}${colors.reset}${' '.repeat(boxWidth)} ${colors.primary}${border.vertical}${colors.reset}\n`;

    // Time & Progress Bar
    const timePlain = `⏱️  [ ${formatTime(playbackPos)} / ${formatTime(totalDuration)} ]  [${speed.toFixed(1)}x]${isPaused ? ' ⏸ PAUSED' : ''}`;
    const timeDisplay = `⏱️  [ ${formatTime(playbackPos)} / ${formatTime(totalDuration)} ]  ${bar}  [${speed.toFixed(1)}x]${isPaused ? ` \x1b[93m⏸ PAUSED${colors.reset}` : ''}`;
    const padLen = Math.max(0, boxWidth - timePlain.length - barWidth - 4);
    frame += `  ${colors.primary}${border.vertical}${colors.reset}  ${timeDisplay}${' '.repeat(padLen)} ${colors.primary}${border.vertical}${colors.reset}\n`;

    // Bottom of box
    frame += `  ${colors.primary}${border.bottomLeft}${border.horizontal.repeat(boxWidth)}${border.bottomRight}${colors.reset}\n\n`;

    // Surrounding lyrics context (-2, -1, [Active], +1, +2)
    const prevLine2 = activeIndex >= 2 ? lines[activeIndex - 2].text : '';
    const prevLine1 = activeIndex >= 1 ? lines[activeIndex - 1].text : '';
    const currentLine = activeIndex >= 0 ? lines[activeIndex] : null;
    const nextLine1 = activeIndex + 1 < lines.length ? lines[activeIndex + 1].text : '';
    const nextLine2 = activeIndex + 2 < lines.length ? lines[activeIndex + 2].text : '';

    frame += `     ${colors.pastLine}${prevLine2 || ' '}${colors.reset}\n`;
    frame += `     ${colors.dim}${prevLine1 || ' '}${colors.reset}\n`;

    if (currentLine) {
      if (currentLine.words && currentLine.words.length > 0) {
        // Karaoke word-by-word highlighting
        let wordStr = '';
        const currentWordIdx = currentLine.words.findIndex((w) => w.timeSeconds > playbackPos);
        const activeWordIndex = currentWordIdx === -1 ? currentLine.words.length - 1 : Math.max(0, currentWordIdx - 1);

        for (let wi = 0; wi < currentLine.words.length; wi++) {
          const w = currentLine.words[wi];
          if (playbackPos >= w.timeSeconds) {
            // Active or sung word
            if (wi === activeWordIndex && th.name === 'karaoke') {
              wordStr += `\x1b[93m● \x1b[1m${w.word}\x1b[0m `;
            } else {
              wordStr += `${colors.wordHighlight}${w.word} ${colors.reset}`;
            }
          } else {
            wordStr += `${colors.wordPending}${w.word} ${colors.reset}`;
          }
        }
        frame += `  ${colors.activePrefix}${wordStr.trim()}${colors.activeSuffix}\n`;
      } else {
        frame += `  ${colors.activePrefix}${colors.activeLine}${currentLine.text}${colors.reset}${colors.activeSuffix}\n`;
      }
    } else {
      frame += `  ${colors.dim}── 🎶 (Instrumental Intro) ──${colors.reset}\n`;
    }

    frame += `     ${colors.nextLine}${nextLine1 || ' '}${colors.reset}\n`;
    frame += `     ${colors.pastLine}${nextLine2 || ' '}${colors.reset}\n\n`;

    // Status bar & Keyboard shortcuts
    frame += `  ${colors.dim}${'─'.repeat(boxWidth)}${colors.reset}\n`;
    frame += `  ${colors.dim}[Space] Pause │ [←/→] Seek 5s │ [+/-] Speed │ [t] Theme (${th.name}) │ [q] Quit${colors.reset}\n`;

    process.stdout.write(frame);
  };

  return new Promise<void>((resolve) => {
    let lastTimeMs = Date.now();
    let spotifyCheckCounter = 0;

    const cleanup = () => {
      if (isExited) return;
      isExited = true;
      clearInterval(timer);

      if (isInteractive) {
        if (process.stdin.isTTY) {
          try {
            process.stdin.setRawMode(false);
          } catch {}
          process.stdin.pause();
        }
        process.stdout.write(`${c.showCursor}\n\n  \x1b[32m✔ Playback finished.\x1b[0m\n\n`);
      }
      resolve();
    };

    if (options.signal) {
      options.signal.addEventListener('abort', cleanup);
    }

    // Set up TTY Keyboard controls
    if (isInteractive && process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      try {
        process.stdin.setRawMode(true);
      } catch {}
      process.stdin.resume();

      process.stdout.write(c.hideCursor);

      process.stdin.on('keypress', (_str: string, key: readline.Key) => {
        if (!key) return;

        // Quit on Ctrl+C or 'q'
        if ((key.ctrl && key.name === 'c') || key.name === 'q') {
          cleanup();
          return;
        }

        // Toggle Pause/Play on Space or 'k'
        if (key.name === 'space' || key.name === 'k') {
          isPaused = !isPaused;
          renderFrame(lastActiveIndex);
          return;
        }

        // Switch Theme live on 't'
        if (key.name === 't') {
          themeIndex = (themeIndex + 1) % allThemes.length;
          currentTheme = allThemes[themeIndex];
          renderFrame(lastActiveIndex);
          return;
        }

        // Seek forward on Right arrow or 'l'
        if (key.name === 'right' || key.name === 'l') {
          playbackPos = Math.min(totalDuration, playbackPos + 5);
          renderFrame(lastActiveIndex);
          return;
        }

        // Seek backward on Left arrow or 'h'
        if (key.name === 'left' || key.name === 'h') {
          playbackPos = Math.max(0, playbackPos - 5);
          renderFrame(lastActiveIndex);
          return;
        }

        // Adjust speed
        if (key.name === 'up' || _str === '+' || _str === '=') {
          speed = Math.min(4.0, +(speed + 0.25).toFixed(2));
          renderFrame(lastActiveIndex);
          return;
        }

        if (key.name === 'down' || _str === '-' || _str === '_') {
          speed = Math.max(0.25, +(speed - 0.25).toFixed(2));
          renderFrame(lastActiveIndex);
          return;
        }
      });
    }

    // Main clock loop (runs at ~40ms intervals for smooth 25fps visualizer & animations)
    const tickIntervalMs = isInteractive ? 40 : 100;
    const timer = setInterval(async () => {
      const now = Date.now();
      const deltaMs = now - lastTimeMs;
      lastTimeMs = now;
      tickCount++;

      if (!isPaused) {
        playbackPos += (deltaMs / 1000) * speed;
      }

      // Check Spotify live sync if requested (every ~1.5s = ~38 ticks)
      if (options.syncSpotify) {
        spotifyCheckCounter++;
        if (spotifyCheckCounter % 38 === 0) {
          try {
            const currentSpotify = await getSpotifyCurrentTrack();
            if (currentSpotify && currentSpotify.query) {
              const currentFull = `${trackArtist} - ${trackTitle}`.toLowerCase();
              const newFull = currentSpotify.query.toLowerCase();
              if (!newFull.includes(trackTitle.toLowerCase()) && !currentFull.includes(currentSpotify.title.toLowerCase())) {
                // Track changed on Spotify!
                trackTitle = currentSpotify.title;
                trackArtist = currentSpotify.artist;
                options.onSpotifyTrackChange?.(currentSpotify);
              }
            }
          } catch {}
        }
      }

      // Find currently active line
      let activeIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].timeSeconds <= playbackPos) {
          activeIndex = i;
        } else {
          break;
        }
      }

      options.onTick?.(playbackPos, activeIndex);

      if (activeIndex !== lastActiveIndex) {
        if (activeIndex > lastActiveIndex) {
          const start = Math.max(0, lastActiveIndex + 1);
          for (let i = start; i <= activeIndex; i++) {
            options.onLine?.(lines[i], i);
            if (!isInteractive) {
              console.log(`${lines[i].rawTime} ${lines[i].text}`);
            }
          }
        }
        lastActiveIndex = activeIndex;
      }

      if (isInteractive) {
        renderFrame(activeIndex);
      }

      // Check if track ended
      if (playbackPos >= totalDuration) {
        cleanup();
      }
    }, tickIntervalMs);
  });
}
