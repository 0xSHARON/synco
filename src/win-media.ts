import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import os from 'node:os';
import type { SpotifyTrack } from './spotify.js';

interface WinMediaState {
  title: string;
  artist: string;
  query: string;
  position: number;
  isPlaying: boolean;
  updatedAt: number;
}

class WindowsMediaManager {
  private ps: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private isReady = false;
  private isStarting = false;
  private latestState: WinMediaState | null = null;
  private pendingResolvers: Array<(track: SpotifyTrack | null) => void> = [];
  private pollTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (os.platform() === 'win32') {
      // Ensure child process terminates when node process exits
      process.on('exit', () => this.dispose());
      process.on('SIGINT', () => this.dispose());
      process.on('SIGTERM', () => this.dispose());
    }
  }

  public init(): void {
    if (os.platform() !== 'win32') return;
    if (this.isStarting || this.ps) return;
    this.isStarting = true;

    try {
      this.ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        '-',
      ], {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      });

      if (!this.ps || !this.ps.stdout || !this.ps.stdin) {
        this.isStarting = false;
        return;
      }

      // Do not keep Node event loop alive for background helper
      this.ps.unref();

      this.rl = readline.createInterface({ input: this.ps.stdout });

      const initScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime] | Out-Null
$op = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
$mgr = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($op)).Result
$propMethod = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
Write-Output "READY"
`;

      this.ps.stdin.write(initScript + '\n');

      this.rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (trimmed === 'READY') {
          this.isReady = true;
          this.isStarting = false;
          // Trigger first query immediately
          this.sendQuery();
          // Start background polling every 500ms for continuous instant state
          this.startPolling();
        } else if (trimmed.startsWith('DATA::')) {
          this.handleDataLine(trimmed);
        }
      });

      this.ps.on('error', () => {
        this.dispose();
      });

      this.ps.on('exit', () => {
        this.isReady = false;
        this.isStarting = false;
        this.ps = null;
        this.rl = null;
      });
    } catch {
      this.isStarting = false;
    }
  }

  private startPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (this.isReady && this.ps?.stdin?.writable) {
        this.sendQuery();
      }
    }, 500);
    this.pollTimer.unref();
  }

  private sendQuery(): void {
    if (!this.ps?.stdin?.writable) return;

    const queryScript = `
$spot = $mgr.GetSessions() | ? { $_.SourceAppUserModelId -like "*Spotify*" } | Select -First 1
if ($spot) {
    $tl = $spot.GetTimelineProperties()
    $pb = $spot.GetPlaybackInfo()
    $pOp = $spot.TryGetMediaPropertiesAsync()
    $p = $propMethod.Invoke($null, @($pOp)).Result
    Write-Output "DATA::$($p.Artist)::$($p.Title)::$($tl.Position.TotalSeconds)::$($pb.PlaybackStatus)"
} else {
    Write-Output "DATA:::::0:None"
}
`;
    this.ps.stdin.write(queryScript + '\n');
  }

  private handleDataLine(line: string): void {
    // Format: DATA::<artist>::<title>::<positionSeconds>::<status>
    const parts = line.split('::');
    if (parts.length >= 5) {
      const artist = parts[1]?.trim() || '';
      const title = parts[2]?.trim() || '';
      const posSec = parseFloat(parts[3]) || 0;
      const status = parts[4]?.trim() || '';
      const isPlaying = status.toLowerCase() === 'playing';

      if (title || artist) {
        const query = artist && title ? `${artist} - ${title}` : title || artist;
        this.latestState = {
          title,
          artist,
          query,
          position: posSec,
          isPlaying,
          updatedAt: Date.now(),
        };
      } else {
        this.latestState = null;
      }
    }

    // Flush any pending resolvers
    if (this.pendingResolvers.length > 0) {
      const currentTrack = this.getLatestTrack();
      const resolvers = [...this.pendingResolvers];
      this.pendingResolvers = [];
      for (const resolve of resolvers) {
        resolve(currentTrack);
      }
    }
  }

  public getLatestTrack(): SpotifyTrack | null {
    if (!this.latestState) return null;

    // Extrapolate current position if still playing
    let position = this.latestState.position;
    if (this.latestState.isPlaying) {
      const elapsedSec = (Date.now() - this.latestState.updatedAt) / 1000;
      position += elapsedSec;
    }

    return {
      title: this.latestState.title,
      artist: this.latestState.artist,
      query: this.latestState.query,
      raw: this.latestState.query,
      position: Math.max(0, position),
      isPlaying: this.latestState.isPlaying,
    };
  }

  public async getTrackAsync(timeoutMs = 800): Promise<SpotifyTrack | null> {
    if (!this.isReady) {
      this.init();
    }

    // If we have a state updated in the last 600ms, return it instantly
    if (this.latestState && Date.now() - this.latestState.updatedAt < 600) {
      return this.getLatestTrack();
    }

    // Otherwise, trigger fresh query and wait up to timeoutMs
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.pendingResolvers.indexOf(resolve);
        if (idx !== -1) {
          this.pendingResolvers.splice(idx, 1);
        }
        resolve(this.getLatestTrack());
      }, timeoutMs);

      this.pendingResolvers.push((track) => {
        clearTimeout(timer);
        resolve(track);
      });

      this.sendQuery();
    });
  }

  public dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.ps) {
      try {
        this.ps.stdin?.write('exit\n');
        this.ps.kill();
      } catch {}
      this.ps = null;
    }
    this.isReady = false;
    this.isStarting = false;
  }
}

export const winMedia = new WindowsMediaManager();
