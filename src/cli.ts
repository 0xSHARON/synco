import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { search, playLyrics, identifyLyricsType } from './index.js';

export async function runCli(): Promise<void> {
  const program = new Command();

  program
    .name('synco')
    .description('Search for LRC format (synchronized lyrics) of a track and play them in CLI')
    .version('1.1.0', '-V, --version', 'Output the version number')
    .argument('<search_term>', 'The search term to find the track or local .lrc file path')
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
    .option('--speed <multiplier>', 'Playback speed multiplier (e.g. 1.0, 1.5, 2.0)', '1.0')
    .action(async (searchTerm: string, opts: any) => {
      try {
        let lrcContent: string | null = null;
        let isLocalFile = false;

        // Check if user passed an existing local .lrc file
        const resolvedPath = path.resolve(searchTerm);
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
          lrcContent = await fs.promises.readFile(resolvedPath, 'utf-8');
          isLocalFile = true;
        } else {
          // Otherwise search online
          lrcContent = await search(searchTerm, {
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
            title: isLocalFile ? path.basename(searchTerm, path.extname(searchTerm)) : searchTerm,
          });

          // Also save file if user explicitly requested a custom output path
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

  // Also support dedicated `synco play <song>` sub-command!
  program
    .command('play <song>')
    .description('Stream and play synchronized lyrics in real time directly in your terminal')
    .option('--speed <multiplier>', 'Playback speed multiplier', '1.0')
    .option('-p, --providers <providers...>', 'Providers to search')
    .option('--enhanced', 'Karaoke word-by-word timing', false)
    .option('-v, --verbose', 'Verbose logs', false)
    .action(async (song: string, cmdOpts: any) => {
      const resolvedPath = path.resolve(song);
      let lrc: string | null = null;
      let isLocal = false;

      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        lrc = await fs.promises.readFile(resolvedPath, 'utf-8');
        isLocal = true;
      } else {
        lrc = await search(song, {
          syncedOnly: true,
          providers: cmdOpts.providers,
          enhanced: cmdOpts.enhanced,
          verbose: cmdOpts.verbose,
        });
      }

      if (!lrc) {
        console.error(`\n❌ No synchronized lyrics found for: "${song}"`);
        process.exitCode = 1;
        return;
      }

      const speed = parseFloat(cmdOpts.speed) || 1.0;
      await playLyrics(lrc, {
        speed,
        title: isLocal ? path.basename(song, path.extname(song)) : song,
      });
    });

  await program.parseAsync(process.argv);
}

runCli();
