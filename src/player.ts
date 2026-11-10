import readline from 'node:readline';
import { formatTime } from './utils.js';

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
    let wordMatch: RegExpExecArray | null;
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
 * Real-time CLI interactive lyrics player.
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

  const trackTitle = options.title || metadata.title || 'Unknown Track';
  const trackArtist = options.artist || metadata.artist || '';

  // ANSI Styles
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    brightCyan: '\x1b[96m',
    green: '\x1b[32m',
    brightGreen: '\x1b[92m',
    yellow: '\x1b[33m',
    brightYellow: '\x1b[93m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
    white: '\x1b[37m',
    clearScreen: '\x1b[2J\x1b[H',
    hideCursor: '\x1b[?25l',
    showCursor: '\x1b[?25h',
    enterAltScreen: '\x1b[?1049h',
    exitAltScreen: '\x1b[?1049l',
  };

  // Helper to render interactive TTY frame
  const renderFrame = (activeIndex: number) => {
    if (!isInteractive) return;

    const termWidth = process.stdout.columns || 80;
    const boxWidth = Math.min(termWidth - 4, 76);

    // Progress bar calculations
    const pct = Math.min(1, Math.max(0, playbackPos / (totalDuration || 1)));
    const barWidth = 26;
    const filled = Math.round(pct * barWidth);
    const bar = '━'.repeat(Math.max(0, filled)) + (filled < barWidth ? '●' : '━') + '─'.repeat(Math.max(0, barWidth - filled - 1));

    let frame = '';
    frame += c.clearScreen;
    frame += `\n  ${c.cyan}╭${'─'.repeat(boxWidth)}╮${c.reset}\n`;
    frame += `  ${c.cyan}│${c.reset}  ${c.bold}🎵 SYNCO TERMINAL LYRICS PLAYER${c.reset}${' '.repeat(Math.max(0, boxWidth - 32))} ${c.cyan}│${c.reset}\n`;

    const titleStr = `Track: "${trackTitle}"${trackArtist ? ` — ${trackArtist}` : ''}`;
    const truncatedTitle = titleStr.length > boxWidth - 4 ? titleStr.slice(0, boxWidth - 7) + '...' : titleStr;
    frame += `  ${c.cyan}│${c.reset}  ${c.gray}${truncatedTitle}${c.reset}${' '.repeat(Math.max(0, boxWidth - truncatedTitle.length - 2))} ${c.cyan}│${c.reset}\n`;

    frame += `  ${c.cyan}│${c.reset}${' '.repeat(boxWidth)} ${c.cyan}│${c.reset}\n`;

    const timeStr = `⏱️  [ ${formatTime(playbackPos)} / ${formatTime(totalDuration)} ]  ${c.green}${bar}${c.reset}  [${speed.toFixed(1)}x]${isPaused ? ` ${c.brightYellow}⏸ PAUSED${c.reset}` : ''}`;
    // Strip ansi for length
    const timePlainLength = `⏱️  [ ${formatTime(playbackPos)} / ${formatTime(totalDuration)} ]  ${bar}  [${speed.toFixed(1)}x]${isPaused ? ' ⏸ PAUSED' : ''}`.length;
    frame += `  ${c.cyan}│${c.reset}  ${timeStr}${' '.repeat(Math.max(0, boxWidth - timePlainLength - 2))} ${c.cyan}│${c.reset}\n`;
    frame += `  ${c.cyan}╰${'─'.repeat(boxWidth)}╯${c.reset}\n\n`;

    // Surrounding lyrics context (-2, -1, [Active], +1, +2)
    const prevLine2 = activeIndex >= 2 ? lines[activeIndex - 2].text : '';
    const prevLine1 = activeIndex >= 1 ? lines[activeIndex - 1].text : '';
    const currentLine = activeIndex >= 0 ? lines[activeIndex] : null;
    const nextLine1 = activeIndex + 1 < lines.length ? lines[activeIndex + 1].text : '';
    const nextLine2 = activeIndex + 2 < lines.length ? lines[activeIndex + 2].text : '';

    frame += `     ${c.gray}${prevLine2 || ' '}${c.reset}\n`;
    frame += `     ${c.dim}${prevLine1 || ' '}${c.reset}\n`;

    if (currentLine) {
      if (currentLine.words && currentLine.words.length > 0) {
        // Karaoke word-by-word highlighting
        let wordStr = '';
        for (const w of currentLine.words) {
          if (playbackPos >= w.timeSeconds) {
            wordStr += `${c.brightYellow}${c.bold}${w.word} ${c.reset}`;
          } else {
            wordStr += `${c.white}${w.word} ${c.reset}`;
          }
        }
        frame += `  ${c.brightGreen}🎤 ▶${c.reset} ${wordStr}${c.brightGreen}◀${c.reset}\n`;
      } else {
        frame += `  ${c.brightCyan}${c.bold}🎤 ▶  ${currentLine.text}  ◀${c.reset}\n`;
      }
    } else {
      frame += `  ${c.gray}── 🎶 (Instrumental Intro) ──${c.reset}\n`;
    }

    frame += `     ${c.white}${c.dim}${nextLine1 || ' '}${c.reset}\n`;
    frame += `     ${c.gray}${nextLine2 || ' '}${c.reset}\n\n`;

    frame += `  ${c.gray}${'─'.repeat(boxWidth)}${c.reset}\n`;
    frame += `  ${c.gray}[Space] Pause/Play  │  [←/→] Seek 5s  │  [+/-] Speed  │  [q] Quit${c.reset}\n`;

    process.stdout.write(frame);
  };

  return new Promise<void>((resolve) => {
    let lastTimeMs = Date.now();

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
        process.stdout.write(`${c.showCursor}\n\n  ${c.green}✔ Playback finished.${c.reset}\n\n`);
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

    // Main clock loop (runs at ~40ms intervals)
    const tickIntervalMs = isInteractive ? 40 : 100;
    const timer = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastTimeMs;
      lastTimeMs = now;

      if (!isPaused) {
        playbackPos += (deltaMs / 1000) * speed;
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
