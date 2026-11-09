import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import syncedlyrics, {
  search,
  Lyrics,
  TargetType,
  formatTime,
  syncedToPlaintext,
  identifyLyricsType,
  hasTranslation,
  strScore,
  strSame,
  getBestMatch,
  sortResults,
  Lrclib,
  Megalobiz,
} from '../src/index.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

async function runTests() {
  console.log('Running test suite for syncedlyrics...\n');

  console.log('[Utils & Formatting]');
  await test('formatTime formats seconds into mm:ss.xx', () => {
    assert.strictEqual(formatTime(0), '00:00.00');
    assert.strictEqual(formatTime(12.34), '00:12.34');
    assert.strictEqual(formatTime(65.78), '01:05.78');
    assert.strictEqual(formatTime(3600), '60:00.00');
  });

  await test('syncedToPlaintext strips timestamp tags and word tags', () => {
    const synced = '[00:12.34] Line one\n[00:15.50] <00:15.50> Word <00:16.00> two';
    const plain = syncedToPlaintext(synced);
    assert.strictEqual(plain, 'Line one\nWord two');
  });

  await test('identifyLyricsType detects synced vs plaintext vs invalid', () => {
    assert.strictEqual(identifyLyricsType(''), 'invalid');
    assert.strictEqual(identifyLyricsType('   '), 'invalid');
    assert.strictEqual(identifyLyricsType('Line one\nLine two\nLine three'), 'plaintext');
    assert.strictEqual(
      identifyLyricsType('[00:10.00] First line\n[00:15.00] Second line'),
      'synced'
    );
  });

  await test('hasTranslation detects parenthesized translations', () => {
    const withTrans = '[00:01.00] Title\n[00:02.00] Line one\n(Translation one)\n[00:05.00] Line two\n(Translation two)';
    assert.strictEqual(hasTranslation(withTrans), true);

    const withoutTrans = '[00:01.00] Title\n[00:02.00] Line one\n[00:05.00] Line two';
    assert.strictEqual(hasTranslation(withoutTrans), false);
  });

  await test('strScore calculates rapidfuzz-compatible token_set_ratio', () => {
    const score1 = strScore('Billie Eilish - bad guy', 'bad guy billie eilish');
    assert.strictEqual(score1, 100);

    const score2 = strScore('Doja Cat Casual', 'bad guy billie eilish');
    assert(score2 < 50, `Expected low score but got ${score2}`);

    const score3 = strScore('Bad Guy - Billie Eilish (feat. Justin Bieber)', 'bad guy billie eilish');
    assert.strictEqual(score3, 100);
  });

  await test('strSame checks threshold match', () => {
    assert.strictEqual(strSame('Billie Eilish - bad guy', 'bad guy billie eilish', 65), true);
    assert.strictEqual(strSame('Doja Cat Casual', 'bad guy billie eilish', 65), false);
  });

  await test('sortResults & getBestMatch identify correct song', () => {
    const items = [
      { name: 'Casual - Doja Cat' },
      { name: 'Bad Guy - Billie Eilish' },
      { name: 'Someone Like You - Adele' },
    ];
    const best = getBestMatch(items, 'bad guy billie eilish', (i) => i.name, 65);
    assert.ok(best);
    assert.strictEqual(best?.name, 'Bad Guy - Billie Eilish');

    const sorted = sortResults(items, 'bad guy billie eilish', (i) => i.name);
    assert.strictEqual(sorted[0].name, 'Bad Guy - Billie Eilish');
  });

  console.log('\n[Lyrics Class]');
  await test('Lyrics handles addUnknown, update, and conversions', () => {
    const lrc = new Lyrics();
    lrc.addUnknown('[00:10.00] Hello world');
    assert.strictEqual(lrc.synced, '[00:10.00] Hello world');
    assert.strictEqual(lrc.unsynced, null);

    assert.strictEqual(lrc.isPreferred(TargetType.PREFER_SYNCED), true);
    assert.strictEqual(lrc.isAcceptable(TargetType.SYNCED_ONLY), true);

    const plainStr = lrc.toStr(TargetType.PLAINTEXT);
    assert.strictEqual(plainStr, 'Hello world');

    const syncedStr = lrc.toStr(TargetType.SYNCED_ONLY);
    assert.strictEqual(syncedStr, '[00:10.00] Hello world');
  });

  await test('Lyrics saves LRC file correctly', async () => {
    const testFile = path.resolve('temp_test.lrc');
    try {
      const lrc = new Lyrics('[00:01.00] Test line', 'Test line');
      await lrc.saveLrcFile(testFile, TargetType.PREFER_SYNCED);
      assert.ok(fs.existsSync(testFile));
      const content = fs.readFileSync(testFile, 'utf-8');
      assert.strictEqual(content, '[00:01.00] Test line');
    } finally {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    }
  });

  console.log('\n[Providers & Search API]');
  await test('Lrclib provider fetches lyrics for a track', async () => {
    const provider = new Lrclib({ timeoutMs: 10000 });
    const res = await provider.getLrc('bad guy billie eilish');
    assert.ok(res, 'Expected Lrclib to return a result');
    assert.ok(res?.synced, 'Expected synced lyrics from Lrclib');
    assert.ok(res?.synced?.includes('[00:'));
  });

  await test('Megalobiz provider fetches lyrics for a track', async () => {
    const provider = new Megalobiz({ timeoutMs: 10000 });
    const res = await provider.getLrc('bad guy billie eilish');
    assert.ok(res, 'Expected Megalobiz to return a result');
    assert.ok(res?.synced, 'Expected synced lyrics from Megalobiz');
    assert.ok(res?.synced?.includes('[00:'));
  });

  await test('search() fetches synced lyrics with default options', async () => {
    const result = await search('bad guy billie eilish');
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('[00:'));
  });

  await test('search() works with callable default export', async () => {
    const result = await syncedlyrics('bad guy billie eilish');
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('[00:'));
  });

  await test('search() with plainOnly returns plaintext', async () => {
    const result = await search('bad guy billie eilish', {
      plainOnly: true,
      providers: ['lrclib'],
    });
    assert.ok(typeof result === 'string');
    assert.strictEqual(identifyLyricsType(result), 'plaintext');
  });

  await test('search() with syncedOnly returns synced lyrics', async () => {
    const result = await search('bad guy billie eilish', {
      syncedOnly: true,
      providers: ['lrclib'],
    });
    assert.ok(typeof result === 'string');
    assert.strictEqual(identifyLyricsType(result), 'synced');
  });

  await test('search() returns null when both plainOnly and syncedOnly are true', async () => {
    const result = await search('bad guy billie eilish', {
      plainOnly: true,
      syncedOnly: true,
    });
    assert.strictEqual(result, null);
  });

  await test('search() supports positional arguments signature', async () => {
    const result = await search(
      'bad guy billie eilish',
      true, // plainOnly
      false, // syncedOnly
      undefined,
      ['lrclib']
    );
    assert.ok(typeof result === 'string');
    assert.strictEqual(identifyLyricsType(result), 'plaintext');
  });

  console.log(`\nTests finished: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
