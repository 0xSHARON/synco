import { execSync } from 'node:child_process';
import os from 'node:os';

export interface SpotifyTrack {
  title: string;
  artist: string;
  query: string;
  raw: string;
  position?: number;
  isPlaying?: boolean;
}

/**
 * Checks if a string is a Spotify URL or URI.
 */
export function isSpotifyUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return (
    input.includes('open.spotify.com/track/') ||
    input.startsWith('spotify:track:') ||
    /^https?:\/\/spotify\.link\/[a-zA-Z0-9]+/.test(input)
  );
}

/**
 * Resolves a Spotify track link or URI into track title & artist.
 * Uses public Spotify oEmbed and open web metadata (no API keys required).
 */
export async function resolveSpotifyUrl(input: string): Promise<SpotifyTrack | null> {
  try {
    let cleanUrl = input.trim();
    if (cleanUrl.startsWith('spotify:track:')) {
      const trackId = cleanUrl.replace('spotify:track:', '').split('?')[0];
      cleanUrl = `https://open.spotify.com/track/${trackId}`;
    }

    // Attempt 1: Fetch Spotify oEmbed endpoint
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    let oembedData: any = null;
    try {
      const res = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'synco/1.2.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        oembedData = await res.json();
      }
    } catch {}

    // Attempt 2: Fetch track page for detailed musician & title metadata
    let pageHtml = '';
    try {
      const pageRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (pageRes.ok) {
        pageHtml = await pageRes.text();
      }
    } catch {}

    let title = oembedData?.title || '';
    let artist = '';

    if (pageHtml) {
      // Extract from music:musician_description
      const artistMeta = pageHtml.match(/<meta\s+name=["']music:musician_description["']\s+content=["']([^"']+)["']/i);
      if (artistMeta) {
        artist = artistMeta[1].trim();
      }

      // Extract from og:title if title not set
      if (!title) {
        const ogTitle = pageHtml.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
        if (ogTitle) {
          title = ogTitle[1].trim();
        }
      }

      // If artist still empty, check og:description (e.g. "Rick Astley · Whenever You Need Somebody · Song · 1987")
      if (!artist) {
        const ogDesc = pageHtml.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
        if (ogDesc) {
          const firstPart = ogDesc[1].split('·')[0].trim();
          if (firstPart) artist = firstPart;
        }
      }

      // Fallback: Page title: "Never Gonna Give You Up - song and lyrics by Rick Astley | Spotify"
      if (!artist || !title) {
        const titleTag = pageHtml.match(/<title>([^<]+)<\/title>/i);
        if (titleTag) {
          const rawTag = titleTag[1].replace(/\s*\|\s*Spotify.*$/i, '').trim();
          const songByMatch = rawTag.match(/^(.+?)\s+-\s+song\s+and\s+lyrics\s+by\s+(.+)$/i);
          if (songByMatch) {
            title = title || songByMatch[1].trim();
            artist = artist || songByMatch[2].trim();
          }
        }
      }
    }

    if (!title && !artist) {
      return null;
    }

    const query = artist && title ? `${artist} - ${title}` : title || artist;
    return {
      title: title || query,
      artist: artist || '',
      query,
      raw: query,
      isPlaying: true,
    };
  } catch {
    return null;
  }
}

/**
 * Detects the currently playing track from the local Spotify client across Windows, macOS, and Linux.
 */
export async function getSpotifyCurrentTrack(): Promise<SpotifyTrack | null> {
  const platform = os.platform();

  if (platform === 'win32') {
    return getSpotifyWindows();
  } else if (platform === 'darwin') {
    return getSpotifyMac();
  } else if (platform === 'linux') {
    return getSpotifyLinux();
  }

  return null;
}

/**
 * Windows: Inspects Spotify window title via tasklist CSV / powershell.
 */
function getSpotifyWindows(): SpotifyTrack | null {
  try {
    const raw = execSync('tasklist /v /fi "imagename eq spotify.exe" /fo csv', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const lines = raw.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Columns: "Image Name","PID","Session Name","Session#","Mem Usage","Status","User Name","CPU Time","Window Title"
      const parts = line.split('","');
      if (parts.length >= 9) {
        let title = parts[8].replace(/[\r\n]/g, '').trim().replace(/^"+|"+$/g, '').trim();

        if (
          title &&
          title !== 'N/A' &&
          title !== 'Window Title' &&
          title !== 'OleMainThreadWndName' &&
          title !== 'Default IME' &&
          title !== 'MSCTFIME UI' &&
          title !== 'GDI+ Window' &&
          !title.startsWith('Spotify')
        ) {
          // Format is typically "Artist - Title"
          const dashIdx = title.indexOf(' - ');
          let artist = '';
          let trackTitle = title;

          if (dashIdx !== -1) {
            artist = title.substring(0, dashIdx).trim();
            trackTitle = title.substring(dashIdx + 3).trim();
          }

          return {
            title: trackTitle,
            artist,
            query: title,
            raw: title,
            isPlaying: true,
          };
        }
      }
    }
  } catch {}

  // Fallback via PowerShell MainWindowTitle
  try {
    const psRaw = execSync(
      'powershell -NoProfile -NonInteractive -Command "Get-Process spotify -ErrorAction SilentlyContinue | ForEach-Object { if ($_.MainWindowTitle) { $_.MainWindowTitle } }"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const titles = psRaw.trim().split(/\r?\n/).filter(Boolean);
    for (const t of titles) {
      const clean = t.trim();
      if (clean && !clean.startsWith('Spotify') && clean !== 'OleMainThreadWndName') {
        const dashIdx = clean.indexOf(' - ');
        let artist = '';
        let trackTitle = clean;
        if (dashIdx !== -1) {
          artist = clean.substring(0, dashIdx).trim();
          trackTitle = clean.substring(dashIdx + 3).trim();
        }
        return {
          title: trackTitle,
          artist,
          query: clean,
          raw: clean,
          isPlaying: true,
        };
      }
    }
  } catch {}

  return null;
}

/**
 * macOS: Inspects Spotify via AppleScript osascript.
 */
function getSpotifyMac(): SpotifyTrack | null {
  try {
    const script = `
      if application "Spotify" is running then
        tell application "Spotify"
          set trackArtist to artist of current track
          set trackName to name of current track
          set playerPos to player position
          set playerSt to player state as string
          return trackArtist & " ::: " & trackName & " ::: " & playerPos & " ::: " & playerSt
        end tell
      end if
    `;
    const output = execSync(`osascript -e '${script.replace(/\n/g, ' ')}'`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (!output || !output.includes(' ::: ')) return null;

    const [artist, title, posStr, state] = output.split(' ::: ');
    const position = parseFloat(posStr) || 0;
    const isPlaying = state?.toLowerCase() === 'playing';

    const cleanTitle = (title || '').trim();
    const cleanArtist = (artist || '').trim();
    const query = cleanArtist && cleanTitle ? `${cleanArtist} - ${cleanTitle}` : cleanTitle || cleanArtist;

    return {
      title: cleanTitle,
      artist: cleanArtist,
      query,
      raw: query,
      position,
      isPlaying,
    };
  } catch {
    return null;
  }
}

/**
 * Linux: Inspects Spotify via playerctl or MPRIS DBus.
 */
function getSpotifyLinux(): SpotifyTrack | null {
  try {
    const output = execSync(
      'playerctl -p spotify metadata --format "{{artist}} ::: {{title}} ::: {{position}} ::: {{status}}"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();

    if (output && output.includes(' ::: ')) {
      const [artist, title, posStr, status] = output.split(' ::: ');
      const position = posStr ? parseFloat(posStr) / 1000000 : 0; // playerctl position is in microseconds
      const isPlaying = status?.toLowerCase() === 'playing';
      const cleanTitle = (title || '').trim();
      const cleanArtist = (artist || '').trim();
      const query = cleanArtist && cleanTitle ? `${cleanArtist} - ${cleanTitle}` : cleanTitle || cleanArtist;

      return {
        title: cleanTitle,
        artist: cleanArtist,
        query,
        raw: query,
        position,
        isPlaying,
      };
    }
  } catch {}

  // Fallback: any MPRIS player
  try {
    const output = execSync('playerctl metadata --format "{{artist}} ::: {{title}} ::: {{position}} ::: {{status}}"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (output && output.includes(' ::: ')) {
      const [artist, title, posStr, status] = output.split(' ::: ');
      const position = posStr ? parseFloat(posStr) / 1000000 : 0;
      const isPlaying = status?.toLowerCase() === 'playing';
      const cleanTitle = (title || '').trim();
      const cleanArtist = (artist || '').trim();
      const query = cleanArtist && cleanTitle ? `${cleanArtist} - ${cleanTitle}` : cleanTitle || cleanArtist;

      return {
        title: cleanTitle,
        artist: cleanArtist,
        query,
        raw: query,
        position,
        isPlaying,
      };
    }
  } catch {}

  return null;
}

/**
 * Watches Spotify desktop player in real time. Calls onChange when the track changes or playback stops.
 */
export function watchSpotify(
  onChange: (track: SpotifyTrack | null) => void,
  intervalMs = 2000
): () => void {
  let lastQuery = '';
  let active = true;

  const check = async () => {
    if (!active) return;
    try {
      const current = await getSpotifyCurrentTrack();
      const currentQuery = current?.query || '';
      if (currentQuery !== lastQuery) {
        lastQuery = currentQuery;
        onChange(current);
      }
    } catch {}
  };

  const timer = setInterval(check, intervalMs);
  return () => {
    active = false;
    clearInterval(timer);
  };
}
