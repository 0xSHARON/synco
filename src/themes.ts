export type ThemeName =
  | 'neon'
  | 'matrix'
  | 'synthwave'
  | 'gradient'
  | 'minimal'
  | 'karaoke'
  | 'dracula'
  | 'ocean'
  | 'classic';

export type AnimationType = 'wave' | 'pulse' | 'bounce' | 'none';

export interface ThemeFrameBorder {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

export interface ThemeColors {
  reset: string;
  bold: string;
  dim: string;
  primary: string;
  secondary: string;
  activeLine: string;
  activePrefix: string;
  activeSuffix: string;
  wordHighlight: string;
  wordPending: string;
  pastLine: string;
  nextLine: string;
  progressFilled: string;
  progressEmpty: string;
  progressBarChar: {
    filled: string;
    playhead: string;
    empty: string;
  };
  frameBorder: ThemeFrameBorder;
  equalizerChars: string[];
  equalizerColor: string;
  badge: string;
}

export interface ThemeDefinition {
  name: ThemeName;
  displayName: string;
  description: string;
  colors: ThemeColors;
  defaultAnimation: AnimationType;
}

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  brightRed: '\x1b[91m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  yellow: '\x1b[33m',
  brightYellow: '\x1b[93m',
  blue: '\x1b[34m',
  brightBlue: '\x1b[94m',
  magenta: '\x1b[35m',
  brightMagenta: '\x1b[95m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  white: '\x1b[37m',
  brightWhite: '\x1b[97m',
  gray: '\x1b[90m',
};

export const THEMES: Record<ThemeName, ThemeDefinition> = {
  neon: {
    name: 'neon',
    displayName: 'Cyberpunk Neon',
    description: 'Vibrant electric cyan & hot magenta glow with glowing laser frames',
    defaultAnimation: 'wave',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.brightCyan,
      secondary: c.brightMagenta,
      activeLine: `${c.brightMagenta}${c.bold}`,
      activePrefix: `${c.brightCyan}⚡ ▶${c.reset} `,
      activeSuffix: ` ${c.brightCyan}◀ ⚡${c.reset}`,
      wordHighlight: `${c.brightYellow}${c.bold}`,
      wordPending: `${c.brightWhite}`,
      pastLine: c.gray,
      nextLine: `${c.brightWhite}${c.dim}`,
      progressFilled: c.brightMagenta,
      progressEmpty: c.gray,
      progressBarChar: { filled: '▰', playhead: '◈', empty: '▱' },
      frameBorder: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
      },
      equalizerChars: [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
      equalizerColor: c.brightCyan,
      badge: `${c.brightCyan}[NEON CYBER]${c.reset}`,
    },
  },
  matrix: {
    name: 'matrix',
    displayName: 'Matrix Rain',
    description: 'Phosphor green digital rain aesthetic with monospace cyber accents',
    defaultAnimation: 'pulse',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.green,
      secondary: c.brightGreen,
      activeLine: `${c.brightGreen}${c.bold}`,
      activePrefix: `${c.green}[01] ❯${c.reset} `,
      activeSuffix: ` ${c.green}❮ [10]${c.reset}`,
      wordHighlight: `${c.brightGreen}${c.bold}`,
      wordPending: `${c.green}`,
      pastLine: c.gray,
      nextLine: `${c.green}${c.dim}`,
      progressFilled: c.brightGreen,
      progressEmpty: c.gray,
      progressBarChar: { filled: '▓', playhead: '█', empty: '░' },
      frameBorder: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
      },
      equalizerChars: ['░', '▒', '▓', '█'],
      equalizerColor: c.brightGreen,
      badge: `${c.brightGreen}[SYS // MATRIX]${c.reset}`,
    },
  },
  synthwave: {
    name: 'synthwave',
    displayName: '80s Synthwave',
    description: 'Sunset violet, warm amber coral, and retro arcade aesthetic',
    defaultAnimation: 'wave',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.magenta,
      secondary: c.brightYellow,
      activeLine: `${c.brightYellow}${c.bold}`,
      activePrefix: `${c.brightRed}🌆 ▶${c.reset} `,
      activeSuffix: ` ${c.brightRed}◀ 🌆${c.reset}`,
      wordHighlight: `${c.brightYellow}${c.bold}`,
      wordPending: `${c.brightWhite}`,
      pastLine: c.gray,
      nextLine: `${c.magenta}${c.dim}`,
      progressFilled: c.brightYellow,
      progressEmpty: c.gray,
      progressBarChar: { filled: '━', playhead: '●', empty: '─' },
      frameBorder: {
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
        horizontal: '═',
        vertical: '║',
      },
      equalizerChars: [' ', '▃', '▅', '▇', '█'],
      equalizerColor: c.brightMagenta,
      badge: `${c.brightYellow}[RETRO // 80s]${c.reset}`,
    },
  },
  gradient: {
    name: 'gradient',
    displayName: 'Chromatic Flow',
    description: 'Dynamic rainbow chromatic spectrum flowing through lyrics',
    defaultAnimation: 'wave',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.brightCyan,
      secondary: c.brightYellow,
      activeLine: `${c.brightCyan}${c.bold}`,
      activePrefix: `${c.brightYellow}🌈 ❯${c.reset} `,
      activeSuffix: ` ${c.brightYellow}❮ 🌈${c.reset}`,
      wordHighlight: `${c.brightGreen}${c.bold}`,
      wordPending: `${c.brightWhite}`,
      pastLine: c.gray,
      nextLine: `${c.brightCyan}${c.dim}`,
      progressFilled: c.brightCyan,
      progressEmpty: c.gray,
      progressBarChar: { filled: '█', playhead: '◈', empty: '░' },
      frameBorder: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
      },
      equalizerChars: [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
      equalizerColor: c.brightYellow,
      badge: `${c.brightCyan}[RAINBOW FLOW]${c.reset}`,
    },
  },
  minimal: {
    name: 'minimal',
    displayName: 'Obsidian Minimal',
    description: 'Clean monochrome high-contrast pure white and slate, distraction-free',
    defaultAnimation: 'pulse',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.gray,
      secondary: c.white,
      activeLine: `${c.brightWhite}${c.bold}`,
      activePrefix: `${c.brightWhite}● ${c.reset}`,
      activeSuffix: ``,
      wordHighlight: `${c.brightWhite}${c.bold}`,
      wordPending: `${c.gray}`,
      pastLine: c.gray,
      nextLine: `${c.white}${c.dim}`,
      progressFilled: c.brightWhite,
      progressEmpty: c.gray,
      progressBarChar: { filled: '━', playhead: '●', empty: '─' },
      frameBorder: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
      },
      equalizerChars: ['·', ':', '|', '!', '█'],
      equalizerColor: c.white,
      badge: `${c.white}[MINIMAL]${c.reset}`,
    },
  },
  karaoke: {
    name: 'karaoke',
    displayName: 'Karaoke Party',
    description: 'Bouncing ball rhythm indicator and glowing celebratory gold',
    defaultAnimation: 'bounce',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.yellow,
      secondary: c.brightGreen,
      activeLine: `${c.brightYellow}${c.bold}`,
      activePrefix: `${c.brightGreen}🎤 ❯${c.reset} `,
      activeSuffix: ` ${c.brightGreen}❮ 🎤${c.reset}`,
      wordHighlight: `${c.brightYellow}${c.bold}`,
      wordPending: `${c.brightWhite}`,
      pastLine: c.gray,
      nextLine: `${c.brightWhite}${c.dim}`,
      progressFilled: c.brightYellow,
      progressEmpty: c.gray,
      progressBarChar: { filled: '━', playhead: '♫', empty: '─' },
      frameBorder: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '═',
        vertical: '║',
      },
      equalizerChars: [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
      equalizerColor: c.brightYellow,
      badge: `${c.brightYellow}[KARAOKE PARTY]${c.reset}`,
    },
  },
  dracula: {
    name: 'dracula',
    displayName: 'Dracula Dark',
    description: 'Famous Dracula dark theme with purple, pink, cyan, and spring green',
    defaultAnimation: 'wave',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.magenta,
      secondary: c.brightCyan,
      activeLine: `${c.brightCyan}${c.bold}`,
      activePrefix: `${c.brightMagenta}🧛 ▶${c.reset} `,
      activeSuffix: ` ${c.brightMagenta}◀ 🧛${c.reset}`,
      wordHighlight: `${c.brightGreen}${c.bold}`,
      wordPending: `${c.brightWhite}`,
      pastLine: c.gray,
      nextLine: `${c.white}${c.dim}`,
      progressFilled: c.brightMagenta,
      progressEmpty: c.gray,
      progressBarChar: { filled: '▰', playhead: '◈', empty: '▱' },
      frameBorder: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
      },
      equalizerChars: [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
      equalizerColor: c.brightMagenta,
      badge: `${c.brightMagenta}[DRACULA]${c.reset}`,
    },
  },
  ocean: {
    name: 'ocean',
    displayName: 'Glacial Ocean',
    description: 'Deep Arctic frost cyan, ocean blue, and icy chill highlights',
    defaultAnimation: 'wave',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.cyan,
      secondary: c.brightCyan,
      activeLine: `${c.brightCyan}${c.bold}`,
      activePrefix: `${c.brightBlue}❄️ ❯${c.reset} `,
      activeSuffix: ` ${c.brightBlue}❮ ❄️${c.reset}`,
      wordHighlight: `${c.brightWhite}${c.bold}`,
      wordPending: `${c.brightCyan}`,
      pastLine: c.gray,
      nextLine: `${c.brightCyan}${c.dim}`,
      progressFilled: c.brightCyan,
      progressEmpty: c.gray,
      progressBarChar: { filled: '█', playhead: '●', empty: '─' },
      frameBorder: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
      },
      equalizerChars: [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
      equalizerColor: c.brightCyan,
      badge: `${c.brightCyan}[ARCTIC OCEAN]${c.reset}`,
    },
  },
  classic: {
    name: 'classic',
    displayName: 'Classic Synco',
    description: 'Standard balanced cyan and emerald green terminal interface',
    defaultAnimation: 'wave',
    colors: {
      reset: c.reset,
      bold: c.bold,
      dim: c.dim,
      primary: c.cyan,
      secondary: c.green,
      activeLine: `${c.brightCyan}${c.bold}`,
      activePrefix: `${c.brightGreen}🎤 ▶  ${c.reset}`,
      activeSuffix: `  ${c.brightGreen}◀${c.reset}`,
      wordHighlight: `${c.brightYellow}${c.bold}`,
      wordPending: `${c.white}`,
      pastLine: c.gray,
      nextLine: `${c.white}${c.dim}`,
      progressFilled: c.green,
      progressEmpty: c.gray,
      progressBarChar: { filled: '━', playhead: '●', empty: '─' },
      frameBorder: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
      },
      equalizerChars: [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
      equalizerColor: c.brightGreen,
      badge: `${c.cyan}[SYNCO]${c.reset}`,
    },
  },
};

/**
 * Retrieves a theme by name with fallback to 'neon'.
 */
export function getTheme(name?: string): ThemeDefinition {
  if (!name) return THEMES.neon;
  const normalized = name.toLowerCase().trim() as ThemeName;
  if (normalized in THEMES) {
    return THEMES[normalized];
  }
  // Common aliases
  if (normalized === ('cyberpunk' as any)) return THEMES.neon;
  if (normalized === ('retro' as any)) return THEMES.synthwave;
  if (normalized === ('rainbow' as any)) return THEMES.gradient;
  if (normalized === ('mono' as any)) return THEMES.minimal;
  if (normalized === ('nord' as any)) return THEMES.ocean;
  if (normalized === ('default' as any)) return THEMES.classic;

  return THEMES.neon;
}

/**
 * Returns an array of all available theme definitions.
 */
export function listThemes(): ThemeDefinition[] {
  return Object.values(THEMES);
}

/**
 * Generates an animated audio equalizer visualizer bar.
 * Height frames oscillate rhythmically like a live music visualizer.
 */
export function generateEqualizerBars(
  tick: number,
  isPaused: boolean,
  theme: ThemeDefinition,
  barsCount = 14
): string {
  const chars = theme.colors.equalizerChars;
  const maxIdx = chars.length - 1;

  if (isPaused) {
    // Flattened idle bars when paused
    return `${theme.colors.equalizerColor}${chars[0].repeat(barsCount)}${theme.colors.reset}`;
  }

  const wave: string[] = [];
  for (let i = 0; i < barsCount; i++) {
    // Compound harmonic sine waves for realistic equalizer bounce
    const v1 = Math.sin((tick * 0.25) + (i * 0.8));
    const v2 = Math.cos((tick * 0.15) - (i * 0.5));
    const v3 = Math.sin((tick * 0.4) + (i * 1.2));
    const norm = (v1 + v2 + v3 + 3) / 6; // 0 to 1
    const idx = Math.min(maxIdx, Math.max(0, Math.floor(norm * (maxIdx + 1))));
    wave.push(chars[idx]);
  }

  return `${theme.colors.equalizerColor}${wave.join('')}${theme.colors.reset}`;
}

/**
 * Generates bouncing karaoke indicator above or inside active word.
 */
export function getBouncingIndicator(wordIndex: number, totalWords: number, theme: ThemeDefinition): string {
  if (theme.name === 'karaoke') {
    return `${c.brightYellow}●${c.reset}`;
  }
  return `${theme.colors.primary}▶${c.reset}`;
}

