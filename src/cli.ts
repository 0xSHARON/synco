import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import {
  search,
  playLyrics,
  identifyLyricsType,
  getSpotifyCurrentTrack,
  resolveSpotifyUrl,
  isSpotifyUrl,
  getTheme,
  listThemes,
  type ThemeName,
  type SpotifyTrack,
} from './index.js';

export async function runCli(): Promise<void> {
  const program = new Command();

  program
    .name('synco')
    .description('Search, get, and play synchronized lyrics with Spotify sync, themes & animations')
    .version('1.2.0', '-V, --version', 'Output the version number');

  // ==========================================
  // 1. `synco get [track_or_url]` Sub-command
  // ==========================================
  program
    .command('get [searchTerm]')
    .description('Auto-sync lyrics from active Spotify playback, Spotify URL, or search query')
    .option('-s, --sync', 'Continuously sync with Spotify desktop player in real time', true)
    .option('-t, --theme <theme>', 'Visual animation theme (neon, matrix, synthwave, gradient, minimal, karaoke, dracula, ocean, classic)', 'neon')
    .option('--speed <multiplier>', 'Playback speed multiplier', '1.0')
    .option('-p, --providers <providers...>', 'Lyrics providers to search')
    .option('-o, --output <path>', "Path to save '.lrc' lyrics file")
    .option('--no-play', 'Output or save lyrics without launching interactive player')
    .option('--enhanced', 'Word-by-word karaoke timing if available', false)
    .option('-v, --verbose', 'Show verbose debug logs', false)
    .action(async (searchTerm: string | undefined, opts: any) => {
      try {
        let query = searchTerm?.trim() || '';
        let detectedSpotify = false;
        let spotifyTrackInfo: SpotifyTrack | null = null;

        // If no search term provided, auto-detect from Spotify
        if (!query) {
          const spotifyTrack = await getSpotifyCurrentTrack();
          if (!spotifyTrack || !spotifyTrack.query) {
            console.error('\n❌ Spotify is not currently playing any track.');
            console.error('💡 Tip: Start playing a song on Spotify and run:');
            console.error('   synco get');
            console.error('   or provide a search term:');
            console.error('   synco get "Bohemian Rhapsody"');
            console.error('   synco get https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT\n');
            process.exitCode = 1;
            return;
          }
          query = spotifyTrack.query;
          detectedSpotify = true;
          spotifyTrackInfo = spotifyTrack;
          console.log(`\n🎵 Detected currently playing on Spotify: "${query}"`);
        } else if (isSpotifyUrl(query)) {
          console.log(`\n🎧 Resolving Spotify track URL...`);
          const resolved = await resolveSpotifyUrl(query);
          if (resolved && resolved.query) {
            query = resolved.query;
            spotifyTrackInfo = resolved;
            console.log(`✔ Resolved to: "${query}"`);
          } else {
            console.error(`\n❌ Could not resolve metadata for Spotify URL: ${query}`);
            process.exitCode = 1;
            return;
          }
        }

        console.log(`🔍 Searching lyrics for: "${query}"...`);

        const lrcContent = await search(query, {
          syncedOnly: opts.play !== false,
          savePath: opts.output,
          providers: opts.providers,
          enhanced: opts.enhanced,
          verbose: opts.verbose,
        });

        if (!lrcContent) {
          console.error(`\n❌ No synchronized lyrics found for: "${query}"`);
          process.exitCode = 1;
          return;
        }

        // Check if user requested --no-play or piping
        const shouldPlay = opts.play !== false && Boolean(process.stdout.isTTY);

        if (!shouldPlay) {
          if (!opts.output) {
            console.log('\n' + lrcContent);
          } else {
            console.log(`\n✔ Saved lyrics for "${query}" to: ${opts.output}`);
          }
          return;
        }

        // Verify synced
        const lyricsType = identifyLyricsType(lrcContent);
        if (lyricsType !== 'synced') {
          console.error('\n⚠️ Lyrics found, but they are plaintext without timestamps.');
          console.log('\n' + lrcContent);
          return;
        }

        const speed = parseFloat(opts.speed) || 1.0;
        await playLyrics(lrcContent, {
          speed,
          theme: opts.theme || 'neon',
          syncSpotify: detectedSpotify && opts.sync,
          title: spotifyTrackInfo?.title || query,
          artist: spotifyTrackInfo?.artist || '',
          startPosition: spotifyTrackInfo?.position ?? 0,
        });

        if (opts.output) {
          const outPath = opts.output.replace('{search_term}', query);
          await fs.promises.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
          await fs.promises.writeFile(path.resolve(outPath), lrcContent, 'utf-8');
          console.log(`Saved lyrics to: ${outPath}`);
        }
      } catch (err: any) {
        console.error('Error:', err?.message ?? err);
        process.exitCode = 1;
      }
    });

  // ==========================================
  // 2. `synco theme [name]` Sub-command
  // ==========================================
  program
    .command('theme [name]')
    .alias('themes')
    .description('List available themes or preview animated terminal lyric animations')
    .option('-p, --preview', 'Preview the theme animation in real time', false)
    .action(async (name: string | undefined, opts: any) => {
      const themes = listThemes();

      // If user specified a theme name or --preview, run live preview!
      if (name || opts.preview) {
        const themeTarget = name?.toLowerCase().trim() || 'neon';
        const th = getTheme(themeTarget);

        console.log(`\n✨ Launching live animated preview for theme: "${th.displayName}" (${th.name})...\n`);

        const mockLrc = `[ti:Theme Animation Preview]
[ar:Synco]
[00:00.00]Welcome to the Synco Themes & Animations Showcase!
[00:01.20]<00:01.20> Vibrant <00:01.60> fluid <00:02.00> audio <00:02.40> visualizer
[00:02.80]Real-time synchronized scrolling lyrics in your terminal
[00:04.20]Press [t] during playback to cycle themes live!
[00:05.50]Press [q] to exit preview`;

        await playLyrics(mockLrc, {
          theme: th,
          speed: 1.0,
          title: `Preview: ${th.displayName}`,
          artist: `Theme: ${th.name}`,
        });
        return;
      }

      // Otherwise list all themes with styling
      console.log('\n  \x1b[1m\x1b[96m╔═══════════════════════════════════════════════════════════════════╗\x1b[0m');
      console.log('  \x1b[1m\x1b[96m║                🎨 SYNCO TERMINAL ANIMATION THEMES                 ║\x1b[0m');
      console.log('  \x1b[1m\x1b[96m╚═══════════════════════════════════════════════════════════════════╝\x1b[0m\n');

      for (const t of themes) {
        const col = t.colors;
        console.log(`  ${col.primary}●\x1b[0m \x1b[1m${t.name.padEnd(11)}\x1b[0m  ${col.badge}  ${t.displayName}`);
        console.log(`    \x1b[90mDescription:\x1b[0m  ${t.description}`);
        console.log(`    \x1b[90mActive Line:\x1b[0m  ${col.activePrefix}${col.activeLine}She sees the light inside of me${col.reset}${col.activeSuffix}`);
        console.log(`    \x1b[90mProgress:\x1b[0m     ${col.progressFilled}${col.progressBarChar.filled.repeat(8)}${col.progressBarChar.playhead}${col.progressEmpty}${col.progressBarChar.empty.repeat(8)}${col.reset}\n`);
      }

      console.log('  \x1b[90m───────────────────────────────────────────────────────────────────\x1b[0m');
      console.log('  \x1b[36m💡 How to use:\x1b[0m');
      console.log('     synco get --theme <name>          # e.g. synco get --theme matrix');
      console.log('     synco play <song> --theme <name>   # e.g. synco play "Yellow" --theme synthwave');
      console.log('     synco theme <name>                 # Live animated preview of any theme');
      console.log('     Press \x1b[1m[t]\x1b[0m during playback to switch themes on the fly!\n');
    });

  // ==========================================
  // 3. `synco play <song>` Sub-command
  // ==========================================
  program
    .command('play <song>')
    .description('Stream and play synchronized lyrics in real time directly in your terminal')
    .option('-t, --theme <theme>', 'Visual theme (neon, matrix, synthwave, gradient, minimal, karaoke, dracula, ocean, classic)', 'neon')
    .option('--speed <multiplier>', 'Playback speed multiplier', '1.0')
    .option('-p, --providers <providers...>', 'Providers to search')
    .option('--enhanced', 'Karaoke word-by-word timing', false)
    .option('-v, --verbose', 'Verbose logs', false)
    .action(async (song: string, cmdOpts: any) => {
      let query = song;
      let title = song;
      let artist = '';
      let isLocal = false;
      const resolvedPath = path.resolve(song);

      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const lrc = await fs.promises.readFile(resolvedPath, 'utf-8');
        title = path.basename(song, path.extname(song));
        const speed = parseFloat(cmdOpts.speed) || 1.0;
        await playLyrics(lrc, {
          speed,
          theme: cmdOpts.theme || 'neon',
          title,
        });
        return;
      }

      if (isSpotifyUrl(song)) {
        console.log(`\n🎧 Resolving Spotify URL...`);
        const resolved = await resolveSpotifyUrl(song);
        if (resolved) {
          query = resolved.query;
          title = resolved.title;
          artist = resolved.artist;
        }
      }

      const lrc = await search(query, {
        syncedOnly: true,
        providers: cmdOpts.providers,
        enhanced: cmdOpts.enhanced,
        verbose: cmdOpts.verbose,
      });

      if (!lrc) {
        console.error(`\n❌ No synchronized lyrics found for: "${query}"`);
        process.exitCode = 1;
        return;
      }

      const speed = parseFloat(cmdOpts.speed) || 1.0;
      await playLyrics(lrc, {
        speed,
        theme: cmdOpts.theme || 'neon',
        title,
        artist,
      });
    });

  // ==========================================
  // 4. Root `synco [search_term]` Default Action
  // ==========================================
  program
    .argument('[search_term]', 'The search term to find the track or local .lrc file path')
    .option(
      '-p, --providers <providers...>',
      'Providers to include in the searching (e.g. lrclib megalobiz musixmatch netease genius)'
    )
    .option('-l, --lang <lang>', 'Language of the translation along with the lyrics')
    .option('-o, --output <path>', "Path to save '.lrc' lyrics", '{search_term}.lrc')
    .option('-v, --verbose', 'Use this flag to show debug logs', false)
    .option('--plain-only', 'Only look for plain text (not synced) lyrics', false)
    .option('--synced-only', 'Only look for synced lyrics', false)
    .option('--enhanced', 'Returns word by word synced lyrics (if available)', false)
    .option('--token <token>', 'Musixmatch user token')
    .option('-P, --play', 'Play synchronized lyrics in real time in the CLI terminal', false)
    .option('-t, --theme <theme>', 'Visual animation theme', 'neon')
    .option('--speed <multiplier>', 'Playback speed multiplier (e.g. 1.0, 1.5, 2.0)', '1.0')
    .action(async (searchTerm: string | undefined, opts: any) => {
      try {
        // If no searchTerm provided, auto-redirect to Spotify auto-get!
        if (!searchTerm) {
          const spotify = await getSpotifyCurrentTrack();
          if (spotify && spotify.query) {
            console.log(`\n🎵 Detected currently playing on Spotify: "${spotify.query}"`);
            const lrc = await search(spotify.query, {
              syncedOnly: true,
              providers: opts.providers,
              enhanced: opts.enhanced,
              verbose: opts.verbose,
            });
            if (lrc) {
              const speed = parseFloat(opts.speed) || 1.0;
              await playLyrics(lrc, {
                speed,
                theme: opts.theme || 'neon',
                title: spotify.title,
                artist: spotify.artist,
                syncSpotify: true,
              });
              return;
            }
          }
          // If no Spotify track, display help
          program.help();
          return;
        }

        let lrcContent: string | null = null;
        let isLocalFile = false;
        let trackTitle = searchTerm;
        let trackArtist = '';

        // Check if user passed an existing local .lrc file
        const resolvedPath = path.resolve(searchTerm);
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
          lrcContent = await fs.promises.readFile(resolvedPath, 'utf-8');
          isLocalFile = true;
          trackTitle = path.basename(searchTerm, path.extname(searchTerm));
        } else {
          let query = searchTerm;
          if (isSpotifyUrl(searchTerm)) {
            const resolved = await resolveSpotifyUrl(searchTerm);
            if (resolved) {
              query = resolved.query;
              trackTitle = resolved.title;
              trackArtist = resolved.artist;
            }
          }

          lrcContent = await search(query, {
            plainOnly: opts.plainOnly,
            syncedOnly: opts.play ? true : opts.syncedOnly,
            savePath: opts.play ? undefined : opts.output,
            providers: opts.providers,
            lang: opts.lang,
            enhanced: opts.enhanced,
            musixmatchToken: opts.token,
            verbose: opts.verbose,
          });
        }

        if (!lrcContent) {
          console.error(`\n❌ No lyrics found for: "${searchTerm}"`);
          process.exitCode = 1;
          return;
        }

        // If --play requested, launch real-time terminal player!
        if (opts.play) {
          const type = identifyLyricsType(lrcContent);
          if (type !== 'synced') {
            console.error('\n⚠️ Lyrics found, but they are plaintext without timestamps and cannot be played.');
            console.log('\n' + lrcContent);
            return;
          }

          const speed = parseFloat(opts.speed) || 1.0;
          await playLyrics(lrcContent, {
            speed,
            theme: opts.theme || 'neon',
            title: trackTitle,
            artist: trackArtist,
          });

          if (opts.output && opts.output !== '{search_term}.lrc') {
            const outPath = opts.output.replace('{search_term}', searchTerm);
            await fs.promises.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
            await fs.promises.writeFile(path.resolve(outPath), lrcContent, 'utf-8');
            console.log(`Saved lyrics to: ${outPath}`);
          }
        } else {
          console.log(lrcContent);
        }
      } catch (err: any) {
        console.error('Error:', err?.message ?? err);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(process.argv);
}

runCli();
