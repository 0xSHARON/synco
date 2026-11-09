import { Command } from 'commander';
import { search } from './index.js';

export async function runCli(): Promise<void> {
  const program = new Command();

  program
    .name('synco')
    .description('Search for LRC format (synchronized lyrics) of a track')
    .version('1.0.0', '-V, --version', 'Output the version number')
    .argument('<search_term>', 'The search term to find the track (e.g. "Song Name Artist")')
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
    .action(async (searchTerm: string, opts: any) => {
      try {
        const lrc = await search(searchTerm, {
          plainOnly: opts.plainOnly,
          syncedOnly: opts.syncedOnly,
          savePath: opts.output,
          providers: opts.providers,
          lang: opts.lang,
          enhanced: opts.enhanced,
          musixmatchToken: opts.token,
          verbose: opts.verbose,
        });

        if (lrc) {
          console.log(lrc);
        } else {
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error('Error:', err?.message ?? err);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(process.argv);
}

runCli();

