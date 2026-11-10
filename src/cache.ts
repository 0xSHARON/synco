import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Returns the directory used for caching lyrics files.
 * Uses OS-standard cache directories:
 * - Windows: %LOCALAPPDATA%/synco/cache
 * - macOS: ~/Library/Caches/synco
 * - Linux: $XDG_CACHE_HOME/synco or ~/.cache/synco
 */
export function getCacheDir(): string {
  const platform = os.platform();
  let baseDir: string;

  if (platform === 'win32' && process.env.LOCALAPPDATA) {
    baseDir = path.join(process.env.LOCALAPPDATA, 'synco', 'cache');
  } else if (platform === 'darwin') {
    baseDir = path.join(os.homedir(), 'Library', 'Caches', 'synco');
  } else if (process.env.XDG_CACHE_HOME) {
    baseDir = path.join(process.env.XDG_CACHE_HOME, 'synco');
  } else {
    baseDir = path.join(os.homedir(), '.cache', 'synco');
  }

  return baseDir;
}

/**
 * Normalizes a query into a clean, safe filename.
 */
export function slugifyKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

/**
 * Retrieves cached lyrics for a query if available.
 */
export function getCachedLyrics(query: string): string | null {
  try {
    const slug = slugifyKey(query);
    if (!slug) return null;

    const cachePath = path.join(getCacheDir(), `${slug}.lrc`);
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8');
      if (content && content.trim().length > 0) {
        return content;
      }
    }
  } catch {}
  return null;
}

/**
 * Saves lyrics to the local disk cache.
 */
export function setCachedLyrics(query: string, lrcContent: string): void {
  try {
    const slug = slugifyKey(query);
    if (!slug || !lrcContent || !lrcContent.trim()) return;

    const dir = getCacheDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const cachePath = path.join(dir, `${slug}.lrc`);
    fs.writeFileSync(cachePath, lrcContent, 'utf-8');
  } catch {}
}

/**
 * Clears all cached lyrics.
 */
export function clearCache(): number {
  try {
    const dir = getCacheDir();
    if (!fs.existsSync(dir)) return 0;

    const files = fs.readdirSync(dir);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.lrc')) {
        fs.unlinkSync(path.join(dir, file));
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Returns cache statistics.
 */
export function getCacheStats(): { count: number; sizeBytes: number; path: string } {
  const dir = getCacheDir();
  let count = 0;
  let sizeBytes = 0;

  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith('.lrc')) {
          count++;
          const stat = fs.statSync(path.join(dir, file));
          sizeBytes += stat.size;
        }
      }
    }
  } catch {}

  return { count, sizeBytes, path: dir };
}
